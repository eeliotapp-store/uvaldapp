/**
 * Crea (o actualiza la contraseña de) UN usuario de prueba para el equipo de desarrollo.
 * Ejecutar con: npx tsx scripts/create-test-user.ts
 *
 * OJO: usa la Supabase de .env.local. Si .env.local apunta a producción, el usuario
 * se crea en producción. Desactívalo cuando no lo estés usando (active = false).
 */

import { createClient } from '@supabase/supabase-js';
import { hash } from 'bcrypt-ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Usuario de prueba ---
const NAME = 'Dev Pruebas';
const USERNAME = 'dev';
const ROLE = 'superadmin';

// Contraseña fuerte aleatoria (14 chars alfanuméricos, sin caracteres confusos)
function strongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  let out = '';
  for (let i = 0; i < 14; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function main() {
  const password = strongPassword();
  const passwordHash = await hash(password, 10);

  const { data: existing } = await supabase
    .from('employees')
    .select('id')
    .eq('username', USERNAME)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('employees')
      .update({ password_hash: passwordHash, role: ROLE, active: true, name: NAME })
      .eq('id', existing.id);
    if (error) throw error;
    console.log(`\n♻️  El usuario "${USERNAME}" ya existía — se actualizó la contraseña y quedó activo.`);
  } else {
    const { error } = await supabase.from('employees').insert({
      name: NAME,
      username: USERNAME,
      password_hash: passwordHash,
      role: ROLE,
      active: true,
    });
    if (error) throw error;
    console.log(`\n✅ Usuario de prueba creado.`);
  }

  console.log('\n========================================');
  console.log('  CREDENCIALES DE PRUEBA (guárdalas)');
  console.log('========================================');
  console.log(`  Usuario:    ${USERNAME}`);
  console.log(`  Contraseña: ${password}`);
  console.log(`  Rol:        ${ROLE}`);
  console.log('========================================\n');
}

main().catch((e) => {
  console.error('❌ Error:', e?.message || e);
  process.exit(1);
});
