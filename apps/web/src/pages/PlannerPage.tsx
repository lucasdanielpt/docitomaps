import { useEffect, useState } from 'react';
import { ArrowLeft, Film, Sparkles, TriangleAlert } from 'lucide-react';
import { LogoWordmark } from '@/components/brand/Logo';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { PlannerPanel } from '@/features/planner/PlannerPanel';
import { MapView } from '@/features/map/MapView';
import { MapStylePicker } from '@/features/map/MapStylePicker';
import { PlayerControls } from '@/features/player/PlayerControls';
import { ExportVideoDialog } from '@/features/export/ExportVideoDialog';
import { LiveNavigationPanel } from '@/features/navigation/LiveNavigationPanel';
import { SavedRoadtripsDialog, useSharedRouteFromUrl } from '@/features/roadtrips/SavedRoadtripsDialog';
import { fetchHealth } from '@/services/api';
import { useRouteStore } from '@/stores/routeStore';
import { usePlayerStore } from '@/stores/playerStore';

export function PlannerPage() {
  const [orsWarning, setOrsWarning] = useState(false);
  const [apiOffline, setApiOffline] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const { sharedName } = useSharedRouteFromUrl();
  const route = useRouteStore((s) => s.route);
  const cinema = usePlayerStore((s) => s.cinema);
  const setCinema = usePlayerStore((s) => s.setCinema);

  useEffect(() => {
    fetchHealth()
      .then((h) => {
        setApiOffline(false);
        setHealthStatus(null);
        setOrsWarning(!h.orsKeyConfigured);
      })
      .catch((err: unknown) => {
        setApiOffline(true);
        setOrsWarning(true);
        setHealthStatus(err instanceof Error ? err.message : 'erro');
      });
  }, []);

  return (
    <div className="relative min-h-screen">
      {!cinema && (
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 px-4 py-3 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <LogoWordmark />
            <div className="flex items-center gap-2">
              <SavedRoadtripsDialog />
              <Chip>
                <Sparkles className="h-3 w-3 text-primary" />
                Sem cadastro — comece já
              </Chip>
            </div>
          </div>
        </header>
      )}

      {!cinema && sharedName && (
        <div className="mx-auto mt-4 max-w-7xl px-4 md:px-8">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm text-foreground shadow-soft">
            Roteiro compartilhado carregado: <strong>{sharedName}</strong>. Clique em{' '}
            <strong>Calcular</strong> para traçar a rota.
          </div>
        </div>
      )}

      {!cinema && orsWarning && (
        <div className="mx-auto mt-4 flex max-w-7xl items-center gap-2 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-900 shadow-soft">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>
            {apiOffline ? (
              <>
                Backend indisponível (<code className="rounded bg-amber-100 px-1">/api/health</code>
                {healthStatus ? ` — ${healthStatus}` : ''}). Confira o deploy na Vercel (Root Directory e
                Build Command) e a variável <strong>ORS_API_KEY</strong>.
              </>
            ) : (
              <>
                Backend sem <strong>ORS_API_KEY</strong>. Na Vercel, adicione em{' '}
                <strong>Settings → Environment Variables</strong>. Localmente, use{' '}
                <code className="rounded bg-amber-100 px-1">apps/api/.env</code> — grátis em{' '}
                <a
                  className="underline"
                  href="https://openrouteservice.org/dev/#/signup"
                  target="_blank"
                  rel="noreferrer"
                >
                  openrouteservice.org
                </a>
                .
              </>
            )}
          </span>
        </div>
      )}

      <div className={cinema ? 'fixed inset-0 z-0' : 'mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8'}>
        {!cinema && (
          <section className="mx-auto max-w-3xl text-center">
            <Chip>
              <span aria-hidden>🍭</span> Planeje. Adoce. Viaje.
            </Chip>
            <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Monte seu roteiro e receba o caminho mais{' '}
              <span className="text-primary">docinho</span> — o mais rápido de todos.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
              Adicione a partida, quantas paradas quiser e o destino final. A gente organiza a ordem
              das paradas para você economizar tempo na estrada.
            </p>
          </section>
        )}

        <section
          className={
            cinema
              ? 'h-full w-full'
              : 'mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(380px,440px)_1fr]'
          }
          aria-label={cinema ? 'Mapa cinema' : 'Planejador'}
        >
          {!cinema && (
            <div className="min-h-[560px]">
              <PlannerPanel />
            </div>
          )}

          <div
            className={
              cinema
                ? 'relative h-full w-full'
                : 'relative h-[560px] overflow-hidden rounded-3xl border border-border bg-card shadow-candy'
            }
          >
            <MapView />
            {!cinema && (
              <div className="pointer-events-none absolute left-4 top-4 z-20">
                <MapStylePicker />
              </div>
            )}
            {!cinema && route && (
              <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex flex-col items-center gap-3">
                <div className="pointer-events-auto">
                  <LiveNavigationPanel />
                </div>
                <Button
                  type="button"
                  variant="candy"
                  size="lg"
                  onClick={() => setCinema(true)}
                  className="pointer-events-auto"
                >
                  <Film className="h-5 w-5" /> Assistir viagem em 3D
                </Button>
              </div>
            )}
          </div>
        </section>

        {!cinema && (
          <footer className="mt-10 text-center text-xs text-muted-foreground">
            Feito com <span className="text-primary">♥</span> e tiles © OpenStreetMap contributors.
            Roteamento por OpenRouteService.
          </footer>
        )}
      </div>

      {cinema && (
        <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between p-4 md:p-6">
          <div className="pointer-events-auto flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCinema(false)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar ao planner
            </Button>
            <div className="flex items-center gap-2">
              <ExportVideoDialog />
              <Chip>
                <Film className="h-3 w-3 text-primary" /> Modo cinema
              </Chip>
            </div>
          </div>
          <PlayerControls />
        </div>
      )}
    </div>
  );
}
