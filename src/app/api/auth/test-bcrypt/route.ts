import { NextResponse } from 'next/server';
import { compare, hash } from 'bcrypt-ts';

export async function GET() {
  try {
    const pin = '1234';

    // Generar un hash nuevo
    const newHash = await hash(pin, 10);

    // Probar comparación con el hash nuevo
    const testNew = await compare(pin, newHash);

    // Probar con un hash conocido (formato $2a$)
    const knownHash2a = '$2a$10$S.t9PkyH6OClv69pInT7p.Xp6Y9.zmUvB9jP0XQ5sU7QG1K.iG8G.';
    const test2a = await compare(pin, knownHash2a);

    // Probar con formato $2b$
    const knownHash2b = '$2b$10$QaBKTSAJKG2NBL2PFNFDaeKAbxqBXqVo87UVbeBSKGCCvr5QukvYS';
    const test2b = await compare(pin, knownHash2b);

    return NextResponse.json({
      message: 'Test de bcryptjs',
      pin_usado: pin,
      nuevo_hash_generado: newHash,
      test_con_hash_nuevo: testNew,
      test_con_hash_2a: test2a,
      test_con_hash_2b: test2b,
      bcryptjs_version: 'check package.json',
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Error en test',
      details: String(error),
    }, { status: 500 });
  }
}
