import { useEffect, useState } from 'react';
import { ArrowLeft, Film, Sparkles, TriangleAlert } from 'lucide-react';
import { LogoWordmark } from '@/components/brand/Logo';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { PlannerPanel } from '@/features/planner/PlannerPanel';
import { MapView } from '@/features/map/MapView';
import { PlayerControls } from '@/features/player/PlayerControls';
import { fetchHealth } from '@/services/api';
import { useRouteStore } from '@/stores/routeStore';
import { usePlayerStore } from '@/stores/playerStore';

export function PlannerPage() {
  const [orsWarning, setOrsWarning] = useState(false);
  const route = useRouteStore((s) => s.route);
  const cinema = usePlayerStore((s) => s.cinema);
  const setCinema = usePlayerStore((s) => s.setCinema);

  useEffect(() => {
    fetchHealth()
      .then((h) => setOrsWarning(!h.orsKeyConfigured))
      .catch(() => setOrsWarning(true));
  }, []);

  if (cinema) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="absolute inset-0">
          <MapView />
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-6">
          <div className="pointer-events-auto flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCinema(false)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar ao planner
            </Button>
            <Chip>
              <Film className="h-3 w-3 text-primary" /> Modo cinema
            </Chip>
          </div>
          <PlayerControls />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <LogoWordmark />
          <Chip>
            <Sparkles className="h-3 w-3 text-primary" />
            Sem cadastro — comece já
          </Chip>
        </div>
      </header>

      {orsWarning && (
        <div className="mx-auto mt-4 flex max-w-7xl items-center gap-2 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-900 shadow-soft">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>
            Backend sem <strong>ORS_API_KEY</strong>. Adicione a chave em{' '}
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
          </span>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-8">
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

        <section
          className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(380px,440px)_1fr]"
          aria-label="Planejador"
        >
          <div className="min-h-[560px]">
            <PlannerPanel />
          </div>
          <div className="relative min-h-[560px] overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-candy backdrop-blur">
            <MapView />
            {route && (
              <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
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

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Feito com <span className="text-primary">♥</span> e tiles © OpenStreetMap contributors.
          Roteamento por OpenRouteService.
        </footer>
      </main>
    </div>
  );
}
