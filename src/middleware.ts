import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Rutas públicas
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

// Rutas solo para owners/superadmin (páginas)
const OWNER_ONLY_PATHS = ['/reports', '/suppliers', '/employees', '/admin', '/stats', '/products', '/combos'];

// APIs solo para owners/superadmin
const OWNER_ONLY_API_PATHS = ['/api/admin', '/api/reports', '/api/employees'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Rutas públicas - permitir sin verificación
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Obtener token de cookie o header Authorization
  let token = request.cookies.get('auth-token')?.value;

  // También aceptar token en header (para llamadas API)
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  // Si es una API protegida y no hay token, devolver 401
  if (!token) {
    if (path.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar token
  const payload = await verifyToken(token);

  if (!payload) {
    if (path.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      );
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth-token');
    return response;
  }

  // Verificar permisos de owner/superadmin para páginas
  const isOwnerPath = OWNER_ONLY_PATHS.some((p) => path.startsWith(p));
  if (isOwnerPath && payload.role !== 'owner' && payload.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // Verificar permisos de owner/superadmin para APIs
  const isOwnerApiPath = OWNER_ONLY_API_PATHS.some((p) => path.startsWith(p));
  if (isOwnerApiPath && payload.role !== 'owner' && payload.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'No tienes permisos para esta acción' },
      { status: 403 }
    );
  }

  // Agregar headers para componentes del servidor
  const response = NextResponse.next();
  response.headers.set('x-employee-id', payload.employee_id);
  response.headers.set('x-employee-role', payload.role);
  response.headers.set('x-employee-name', encodeURIComponent(payload.name));

  return addSecurityHeaders(response);
}

// Agregar headers de seguridad a todas las respuestas
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevenir que el sitio sea embebido en iframes (clickjacking)
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevenir sniffing de tipo MIME
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Habilitar protección XSS del navegador
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Política de referrer
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Política de permisos (deshabilitar APIs peligrosas)
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: [
    // Proteger todas las rutas excepto assets estáticos
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
