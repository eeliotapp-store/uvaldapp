import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];
const OWNER_ONLY_PATHS = ['/reports', '/products', '/suppliers', '/employees'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Rutas públicas
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Obtener token
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar token
  const payload = await verifyToken(token);

  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth-token');
    return response;
  }

  // Verificar permisos de owner/superadmin
  const isOwnerPath = OWNER_ONLY_PATHS.some((p) => path.startsWith(p));
  if (isOwnerPath && payload.role !== 'owner' && payload.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // Agregar headers para componentes del servidor
  const response = NextResponse.next();
  response.headers.set('x-employee-id', payload.employee_id);
  response.headers.set('x-employee-role', payload.role);
  response.headers.set('x-employee-name', payload.name);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
