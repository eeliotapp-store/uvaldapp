export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Guía y Reglas del Sistema</h1>
        <p className="text-gray-600 dark:text-neutral-300 mt-1">
          Cómo funcionan los turnos y cómo se cuentan los días en Estadísticas.
        </p>
      </div>

      {/* Turnos */}
      <section className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-1">Tipos de turno y horario</h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4">
          El sistema detecta el tipo de turno automáticamente según la hora al momento de iniciarlo, pero se
          puede cambiar a mano en la pantalla de &quot;Iniciar Turno&quot;.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-4 bg-violet-50 dark:bg-violet-950 rounded-lg">
            <span className="text-2xl">☀️</span>
            <div>
              <p className="font-semibold text-violet-800 dark:text-violet-400">Turno de Día</p>
              <p className="text-sm text-violet-800/80 dark:text-violet-400/80">6:00 a.m. – 5:59 p.m.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <span className="text-2xl">🌙</span>
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-400">Turno de Noche</p>
              <p className="text-sm text-blue-800/80 dark:text-blue-400/80">6:00 p.m. – 5:59 a.m.</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-3">
          El turno de noche cruza la medianoche: empieza un día y termina en la madrugada del día siguiente.
        </p>
      </section>

      {/* Día hábil */}
      <section className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-1">
          ¿A qué día pertenece una venta?
        </h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4">
          Esta regla es la que usa Estadísticas en &quot;Ventas por día de la semana&quot; y &quot;Predicción para hoy&quot;.
        </p>

        <div className="bg-gray-50 dark:bg-neutral-950 rounded-lg p-4 mb-4">
          <p className="text-gray-800 dark:text-neutral-200">
            Toda venta hecha <strong>antes de las 6:00 a.m.</strong> se cuenta como parte del{' '}
            <strong>día calendario anterior</strong>, no del día en que el reloj ya cambió.
          </p>
        </div>

        <p className="text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Ejemplo</p>
        <p className="text-sm text-gray-600 dark:text-neutral-300 mb-4">
          Un turno de noche que arranca el sábado a las 6:00 p.m. y sigue vendiendo hasta las 3:00 a.m. del
          domingo: <strong>todas</strong> esas ventas, incluso las de después de medianoche, se siguen contando
          como <strong>sábado</strong>. El turno no se parte entre dos días distintos en los reportes.
        </p>

        <p className="text-sm text-gray-600 dark:text-neutral-300">
          Por la misma regla, el turno de noche del domingo (desde las 6:00 p.m.) sigue sumando a{' '}
          <strong>domingo</strong> hasta las 6:00 a.m. del lunes. Si un domingo aparece con pocas ventas en
          Estadísticas, casi siempre es porque hubo poca operación ese día (menos horas abiertas o menos
          turnos registrados históricamente ese domingo) — no un error de conteo.
        </p>
      </section>

      {/* Qué ventas se cuentan */}
      <section className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-3">Qué ventas se cuentan</h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-neutral-300 list-disc list-inside">
          <li>Las ventas <strong>anuladas</strong> no se cuentan en ningún reporte.</li>
          <li>
            Los <strong>fiados</strong> (cuentas abiertas) solo se cuentan una vez que quedan pagadas/cerradas —
            mientras estén abiertas, no aparecen en las estadísticas por día.
          </li>
        </ul>
      </section>

      {/* Productos por día */}
      <section className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-3">
          &quot;Productos por día&quot; en Estadísticas
        </h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-neutral-300 list-disc list-inside">
          <li>No incluye productos vendidos dentro de un combo (esos se cuentan aparte, como combo).</li>
          <li>
            Solo se muestran productos con al menos 15 unidades vendidas en todo su historial, para que una
            venta suelta no aparezca como si fuera un patrón del día.
          </li>
        </ul>
      </section>

      {/* Soporte */}
      <section className="bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-xl p-6 text-center">
        <h2 className="text-lg font-bold text-violet-900 dark:text-violet-300 mb-1">¿Algún problema?</h2>
        <p className="text-sm text-violet-800 dark:text-violet-400 mb-3">
          Escríbenos por WhatsApp y te ayudamos.
        </p>
        <a
          href="https://wa.me/573045672366"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          +57 304 5672366
        </a>
        <p className="mt-4 text-xs text-violet-700 dark:text-violet-500">Hecho con ♥</p>
      </section>
    </div>
  );
}
