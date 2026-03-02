/**
 * Script para crear usuarios del sistema
 * Ejecutar con: npx tsx scripts/create-users.ts
 */

// Generar contraseña aleatoria de 6 caracteres
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
  { name: 'Admin', username: 'admin', password: generatePassword(), role: 'superadmin' },
];

async function createUsers() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  console.log('\n========================================');
  console.log('  CREACIÓN DE USUARIOS - CERVECERÍA');
  console.log('========================================\n');

  const results: { user: UserToCreate; success: boolean; error?: string }[] = [];

  for (const user of users) {
    try {
      const response = await fetch(`${baseUrl}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      const data = await response.json();

      if (response.ok) {
        results.push({ user, success: true });
        console.log(`✅ ${user.name} (${user.username}) - Creado exitosamente`);
      } else {
        results.push({ user, success: false, error: data.error });
        console.log(`❌ ${user.name} (${user.username}) - Error: ${data.error}`);
      }
    } catch (error) {
      results.push({ user, success: false, error: String(error) });
      console.log(`❌ ${user.name} (${user.username}) - Error de conexión`);
    }
  }

  // Mostrar resumen con contraseñas
  console.log('\n========================================');
  console.log('  CREDENCIALES DE ACCESO');
  console.log('  (GUARDA ESTA INFORMACIÓN)');
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

createUsers();
