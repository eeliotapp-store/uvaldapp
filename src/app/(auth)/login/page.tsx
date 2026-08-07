'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al iniciar sesión');
        setIsLoading(false);
        return;
      }

      // Guardar en store
      login(data.employee);

      // Redirigir según rol
      if (data.employee.role === 'owner') {
        router.push('/');
      } else {
        router.push('/pos');
      }
    } catch {
      setError('Error de conexión');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Resplandor de marca */}
      <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-violet-500/20 dark:bg-violet-600/25 rounded-full blur-[110px] pointer-events-none" />

      {/* Logo + bienvenida */}
      <div className="relative mb-6 text-center">
        <div className="relative inline-block mb-3">
          <div className="absolute inset-0 bg-violet-500/40 rounded-2xl blur-xl pointer-events-none" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/uvaldapp-icon.png"
            alt="La Boli Fenix"
            className="relative w-20 h-20 rounded-2xl shadow-2xl ring-1 ring-white/20"
          />
        </div>
        <h1 className="text-3xl font-display font-bold tracking-tight text-gray-900 dark:text-neutral-50">La Boli Fenix</h1>
        <p className="font-handwrite text-3xl text-violet-500 dark:text-violet-400 mt-1">Bienvenida de nuevo</p>
      </div>

      {/* Card */}
      <div className="relative bg-white/80 dark:bg-neutral-800/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-neutral-700/60 p-7 w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Tu usuario"
              required
              autoComplete="username"
              className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Tu contraseña"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 dark:text-red-400 text-sm text-center bg-red-50 dark:bg-red-950 py-2 px-3 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 text-lg"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Ingresando...
              </span>
            ) : (
              'Ingresar'
            )}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="relative mt-6 text-xs text-gray-500 dark:text-neutral-500">
        Hecho con ♥ para La Boli Fenix <span className="opacity-60">· uvaldapp</span>
      </p>
    </div>
  );
}
