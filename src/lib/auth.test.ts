import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import { hashPassword, validatePassword, generateToken, verifyToken } from './auth';
import type { Employee } from '@/types/database';

beforeAll(() => {
  // bcrypt es lento a propósito — bajamos las rondas solo para que los tests corran rápido
  process.env.BCRYPT_ROUNDS = '4';
});

const employee: Employee = {
  id: 'emp-1',
  username: 'laura',
  name: 'Laura',
  password_hash: '',
  role: 'owner',
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('hashPassword / validatePassword', () => {
  it('un hash valida correctamente contra su propia contraseña', async () => {
    const hash = await hashPassword('miclave123');
    expect(await validatePassword('miclave123', hash)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('miclave123');
    expect(await validatePassword('otra-clave', hash)).toBe(false);
  });

  it('el hash nunca es igual a la contraseña en texto plano', async () => {
    const hash = await hashPassword('secreto');
    expect(hash).not.toBe('secreto');
  });

  it('validatePassword no lanza error con un hash corrupto/vacío, devuelve false', async () => {
    expect(await validatePassword('cualquiera', '')).toBe(false);
    expect(await validatePassword('cualquiera', 'no-es-un-hash-valido')).toBe(false);
  });

  it('validatePassword captura una excepción interna y devuelve false en vez de propagarla', async () => {
    // Un valor que no es string fuerza que bcrypt-ts lance internamente al intentar parsear el salt
    expect(await validatePassword('cualquiera', undefined as unknown as string)).toBe(false);
  });
});

describe('validación de JWT_SECRET al cargar el módulo en producción', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('lanza un error al importar si NODE_ENV=production y no hay JWT_SECRET', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');

    await expect(import('./auth')).rejects.toThrow(/JWT_SECRET/);
  });

  it('lanza un error al importar si JWT_SECRET es muy corto (<32 caracteres) en producción', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'muy-corto');

    await expect(import('./auth')).rejects.toThrow(/JWT_SECRET/);
  });

  it('NO lanza error en producción cuando JWT_SECRET tiene 32+ caracteres', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'a'.repeat(32));

    await expect(import('./auth')).resolves.toBeDefined();
  });
});

describe('generateToken / verifyToken', () => {
  it('un token generado se verifica correctamente y trae los datos del empleado', async () => {
    const token = await generateToken(employee);
    const payload = await verifyToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.employee_id).toBe('emp-1');
    expect(payload!.name).toBe('Laura');
    expect(payload!.role).toBe('owner');
  });

  it('rechaza un token alterado (firma inválida)', async () => {
    const token = await generateToken(employee);
    const tampered = token.slice(0, -3) + 'xyz';

    expect(await verifyToken(tampered)).toBeNull();
  });

  it('rechaza un texto que no es un JWT en absoluto', async () => {
    expect(await verifyToken('esto-no-es-un-token')).toBeNull();
  });

  it('rechaza un token expirado', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'desarrollo-local-cambiar-en-produccion');
    const expiredToken = await new SignJWT({ employee_id: 'emp-1', name: 'Laura', role: 'owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // expiró hace 1 minuto
      .sign(secret);

    expect(await verifyToken(expiredToken)).toBeNull();
  });

  it('rechaza un token firmado con una llave distinta', async () => {
    const otherSecret = new TextEncoder().encode('otra-llave-completamente-distinta-de-32-caracteres');
    const foreignToken = await new SignJWT({ employee_id: 'emp-1', name: 'Laura', role: 'owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(otherSecret);

    expect(await verifyToken(foreignToken)).toBeNull();
  });
});
