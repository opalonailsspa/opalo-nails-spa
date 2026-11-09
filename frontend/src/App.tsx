import { useState, useEffect, lazy, Suspense } from 'react';

// Carga perezosa (Code-Splitting): Las clientas solo descargan la web de reservas, ahorrando ~600KB de código del Dashboard
const OpaloNailsBooking = lazy(() =>
  import('./components/OpaloNailsBooking').then((m) => ({ default: m.OpaloNailsBooking }))
);
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
        {mensaje || 'Ópalo Nails Spa'}
      </p>
    </div>
  );
}

export function App() {
  const getRutaActual = () => {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (['admin', 'opalo-admin', 'dashboard', 'turnos', 'spa-dashboard'].includes(path)) {
      return 'admin';
    }
    return 'reservas';
  };

  const [vista, setVista] = useState<'reservas' | 'admin'>(getRutaActual);

  useEffect(() => {
    const onPopState = () => {
      setVista(getRutaActual());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const irAlAdmin = () => {
    window.history.pushState(null, '', '/opalo-admin');
    setVista('admin');
  };

  const irAReservas = () => {
    window.history.pushState(null, '', '/');
    setVista('reservas');
  };

  if (vista === 'admin') {
    return (
      <Suspense fallback={<PantallaCarga mensaje="Cargando Panel de Administración..." />}>
        <OpaloNailsDashboard
          onIrAWebReservas={irAReservas}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PantallaCarga mensaje="Preparando tu experiencia de belleza en Ópalo Nails Spa..." />}>
      <OpaloNailsBooking onIrAlAdmin={irAlAdmin} />
    </Suspense>
  );
}

export default App;
