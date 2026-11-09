import { lazy, Suspense } from 'react';

/*
 * Vista pública anterior de reservas/citas para clientas (preservada para integración futura):
 * const OpaloNailsBooking = lazy(() =>
 *   import('./components/OpaloNailsBooking').then((m) => ({ default: m.OpaloNailsBooking }))
 * );
 */

const OpaloNailsDashboard = lazy(() =>
  import('./components/OpaloNailsDashboard').then((m) => ({ default: m.OpaloNailsDashboard }))
);

function PantallaCarga({ mensaje }: { mensaje?: string }) {
  return (
    <div className="min-h-screen bg-[#F5F8F4] flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-[#C5D6BE] border-t-[#C5A059] animate-spin" />
        <span className="absolute text-xl">✨</span>
      </div>
      <p className="mt-4 text-xs font-bold tracking-wider text-[#2E5A44] uppercase animate-pulse">
        {mensaje || 'Portal del Equipo & Administración · Ópalo Nails Spa'}
      </p>
    </div>
  );
}

export function App() {
  /*
   * Flujo de entrada directo: Carga directamente la pantalla de selección de perfil
   * del portal del equipo & administración (1 Administradora y 4 Especialistas).
   * La vista de reservas de clientas queda omitida/preservada arriba para integración futura.
   */
  return (
    <Suspense fallback={<PantallaCarga mensaje="Cargando Portal de Ópalo Nails Spa..." />}>
      <OpaloNailsDashboard />
    </Suspense>
  );
}

export default App;
