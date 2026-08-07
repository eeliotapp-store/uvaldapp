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
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <span className="text-2xl">☀️</span>
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-400">Turno de Día</p>
              <p className="text-sm text-amber-800/80 dark:text-amber-400/80">6:00 a.m. – 5:59 p.m.</p>
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
    </div>
  );
}
