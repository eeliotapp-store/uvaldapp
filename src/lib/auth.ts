import { compare, hash } from 'bcrypt-ts';
import { SignJWT, jwtVerify } from 'jose';
import type { Employee, EmployeeRole } from '@/types/database';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'desarrollo-local-cambiar-en-produccion'
);

export interface JWTPayload {
  employee_id: string;
  name: string;
  role: EmployeeRole;
}

export async function validatePassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isValid = await compare(password, hashedPassword);
    return isValid;
  } catch (error) {
    console.error('[validatePassword] ERROR:', error);
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
  return hash(password, rounds);
}

export async function generateToken(employee: Employee): Promise<string> {
  return new SignJWT({
    employee_id: employee.id,
    name: employee.name,
    role: employee.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}
