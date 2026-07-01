import { useEffect, useState } from 'react';
import { Map as MapIcon, TriangleAlert } from 'lucide-react';
import { PlannerPanel } from '@/features/planner/PlannerPanel';
import { MapView } from '@/features/map/MapView';
import { fetchHealth } from '@/services/api';

export function PlannerPage() {
  const [orsWarning, setOrsWarning] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((h) => setOrsWarning(!h.orsKeyConfigured))
      .catch(() => setOrsWarning(true));
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
            <MapIcon className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">DocitoMapas</h1>
            <p className="text-xs leading-tight text-muted-foreground">
              Guia 3D de Roteiros de Viagem
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">© OpenStreetMap contributors</span>
        </div>
      </header>

      {orsWarning && (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>
            Backend sem <strong>ORS_API_KEY</strong> configurada. Busca de endereços e cálculo de
            rotas estão desativados até que uma chave gratuita seja adicionada em{' '}
            <code className="rounded bg-amber-100 px-1">apps/api/.env</code> (obtenha em{' '}
            <a
              className="underline"
              href="https://openrouteservice.org/dev/#/signup"
              target="_blank"
              rel="noreferrer"
            >
              openrouteservice.org
            </a>
            ).
          </span>
        </div>
      )}

      <main className="flex flex-1 overflow-hidden">
        <PlannerPanel />
        <section className="relative flex-1 bg-muted">
          <MapView />
        </section>
      </main>
    </div>
  );
}
