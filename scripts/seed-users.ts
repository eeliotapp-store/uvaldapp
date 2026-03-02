/**
 * Script para crear usuarios directamente en Supabase
 * Ejecutar con: npx tsx scripts/seed-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import { hash } from 'bcrypt-ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cargar variables de entorno manualmente
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Generar contraseña aleatoria
function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

interface UserToCreate {
  name: string;
  username: string;
  password: string;
  role: 'employee' | 'owner' | 'superadmin';
}

const users: UserToCreate[] = [
  // Empleadas
  { name: 'Natalia', username: 'natalia', password: generatePassword(), role: 'employee' },
  { name: 'Daniela', username: 'daniela', password: generatePassword(), role: 'employee' },
  { name: 'Mafe', username: 'mafe', password: generatePassword(), role: 'employee' },
  // Admin/Dueñas
  { name: 'Laura', username: 'laura', password: generatePassword(), role: 'owner' },
  { name: 'Natalia Admin', username: 'nataliaadmin', password: generatePassword(), role: 'owner' },
  // Super Admin
  { name: 'Super Admin', username: 'admin', password: generatePassword(), role: 'superadmin' },
];

async function seedUsers() {
  console.log('\n========================================');
  console.log('  CREACIÓN DE USUARIOS - CERVECERÍA');
  console.log('========================================\n');

  const results: { user: UserToCreate; success: boolean; error?: string }[] = [];

  for (const user of users) {
    try {
      // Verificar si ya existe
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('username', user.username)
        .single();

      if (existing) {
        console.log(`⚠️  ${user.name} (${user.username}) - Ya existe, omitiendo`);
        results.push({ user, success: true });
        continue;
      }

      // Hash de la contraseña
      const passwordHash = await hash(user.password, 10);

      // Insertar usuario
      const { error } = await supabase.from('employees').insert({
        name: user.name,
        username: user.username,
        password_hash: passwordHash,
        role: user.role,
        active: true,
      });

      if (error) {
        throw error;
      }

      results.push({ user, success: true });
      console.log(`✅ ${user.name} (${user.username}) - Creado exitosamente`);
    } catch (error: any) {
      results.push({ user, success: false, error: error?.message || String(error) });
      console.log(`❌ ${user.name} (${user.username}) - Error: ${error?.message || error}`);
    }
  }

  // Mostrar resumen
  console.log('\n========================================');
  console.log('  CREDENCIALES DE ACCESO');
  console.log('  ⚠️  GUARDA ESTA INFORMACIÓN ⚠️');
  console.log('========================================\n');

  console.log('EMPLEADAS:');
  console.log('─────────────────────────────────────');
  users.filter(u => u.role === 'employee').forEach(u => {
    const result = results.find(r => r.user.username === u.username);
    const status = result?.success ? '✅' : '❌';
    console.log(`${status} ${u.name.padEnd(15)} | Usuario: ${u.username.padEnd(12)} | Contraseña: ${u.password}`);
  });

  console.log('\nADMIN/DUEÑAS:');
  console.log('─────────────────────────────────────');
  users.filter(u => u.role === 'owner').forEach(u => {
    const result = results.find(r => r.user.username === u.username);
    const status = result?.success ? '✅' : '❌';
    console.log(`${status} ${u.name.padEnd(15)} | Usuario: ${u.username.padEnd(12)} | Contraseña: ${u.password}`);
  });

  console.log('\nSUPER ADMIN:');
  console.log('─────────────────────────────────────');
  users.filter(u => u.role === 'superadmin').forEach(u => {
    const result = results.find(r => r.user.username === u.username);
    const status = result?.success ? '✅' : '❌';
    console.log(`${status} ${u.name.padEnd(15)} | Usuario: ${u.username.padEnd(12)} | Contraseña: ${u.password}`);
  });

  console.log('\n========================================\n');
}

seedUsers().catch(console.error);
