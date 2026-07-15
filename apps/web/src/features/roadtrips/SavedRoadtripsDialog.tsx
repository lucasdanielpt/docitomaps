import { useCallback, useEffect, useState } from 'react';
import { Bookmark, Copy, Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  deleteRoadtrip,
  listSavedRoadtrips,
  saveRoadtrip,
  type StoredRoadtrip,
} from '@/lib/roadtripStorage';
import {
  buildShareUrl,
  clearShareParamFromUrl,
  parseShareFromLocation,
  sharePayloadToSnapshot,
  snapshotToSharePayload,
} from '@/lib/shareRoute';
import { useRouteStore } from '@/stores/routeStore';
import { formatDurationSeconds } from '@/lib/utils';

function snapshotFromStore() {
  const s = useRouteStore.getState();
  return {
    origin: s.origin,
    destination: s.destination,
    stops: s.stops,
    mode: s.mode,
    preferences: s.preferences,
    optimize: s.optimize,
    route: s.route,
    optimizedOrder: s.optimizedOrder,
  };
}

export function SavedRoadtripsDialog() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StoredRoadtrip[]>([]);
  const [name, setName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const origin = useRouteStore((s) => s.origin);
  const destination = useRouteStore((s) => s.destination);
  const loadSnapshot = useRouteStore((s) => s.loadSnapshot);

  const canSave = origin !== null && (destination !== null || useRouteStore.getState().stops.length > 0);

  const refresh = useCallback(() => {
    setItems(listSavedRoadtrips());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleCopyCurrentLink = async () => {
    const payload = snapshotToSharePayload(snapshotFromStore(), name.trim() || undefined);
    if (!payload) {
      setMessage('Preencha partida e destino para gerar o link.');
      return;
    }
    const url = buildShareUrl(payload);
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Link copiado! Quem abrir verá este roteiro.');
    } catch {
      setMessage(url);
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    const saved = saveRoadtrip(name, snapshotFromStore());
    setName('');
    setMessage(`"${saved.name}" salvo neste navegador.`);
    refresh();
  };

  const handleLoad = (item: StoredRoadtrip) => {
    loadSnapshot(item.snapshot);
    setMessage(`Roteiro "${item.name}" carregado.`);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteRoadtrip(id);
    refresh();
  };

  const handleCopyLink = async (item: StoredRoadtrip) => {
    const payload = snapshotToSharePayload(item.snapshot, item.name);
    if (!payload) {
      setMessage('Este roteiro não tem partida/destino para compartilhar.');
      return;
    }
    const url = buildShareUrl(payload);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setMessage('Não foi possível copiar — selecione o link manualmente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Bookmark className="h-4 w-4" /> Roteiros
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seus roteiros</DialogTitle>
          <DialogDescription>
            Salvos neste navegador (localStorage). Compartilhe um link curto — quem abrir verá
            partida, paradas e destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-border/50 bg-secondary/20 p-4">
            <Label htmlFor="roadtrip-name">Salvar roteiro atual</Label>
            <div className="flex gap-2">
              <Input
                id="roadtrip-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Doces de Minas — fim de semana"
                disabled={!canSave}
              />
              <Button type="button" variant="candy" onClick={handleSave} disabled={!canSave}>
                Salvar
              </Button>
            </div>
            {!canSave && (
              <p className="text-xs text-muted-foreground">Preencha partida e destino para salvar.</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!canSave}
              onClick={() => void handleCopyCurrentLink()}
            >
              <Link2 className="h-4 w-4" /> Copiar link do roteiro atual
            </Button>
          </div>

          {message && (
            <p className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
              {message}
            </p>
          )}

          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum roteiro salvo ainda. Monte um caminho e clique em Salvar.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.snapshot.stops.length} parada(s)
                      {item.snapshot.route
                        ? ` · ${formatDurationSeconds(item.snapshot.route.totalDurationSeconds)}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => handleLoad(item)}>
                      Carregar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => void handleCopyLink(item)}
                    >
                      {copiedId === item.id ? (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Link2 className="h-3.5 w-3.5" /> Link
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Excluir ${item.name}`}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Carrega roteiro compartilhado via ?r=… na URL (montar uma vez no App). */
export function useSharedRouteFromUrl(): { loading: boolean; sharedName: string | null } {
  const [loading, setLoading] = useState(true);
  const [sharedName, setSharedName] = useState<string | null>(null);
  const loadSnapshot = useRouteStore((s) => s.loadSnapshot);

  useEffect(() => {
    const payload = parseShareFromLocation(window.location.search);
    if (payload) {
      loadSnapshot(sharePayloadToSnapshot(payload));
      setSharedName(payload.name ?? null);
      clearShareParamFromUrl();
    }
    setLoading(false);
  }, [loadSnapshot]);

  return { loading, sharedName };
}
