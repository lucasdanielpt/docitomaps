import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/** Evita que falhas do Cesium derrubem o modo cinema inteiro. */
export class CesiumErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[DocitoMapas][cesium] ErrorBoundary:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="absolute inset-0 z-[5] flex items-start justify-center bg-background/80 p-6">
            <div className="max-w-md rounded-2xl border border-amber-300/70 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-candy">
              <p className="font-semibold">Modo Foto (3D) falhou</p>
              <p className="mt-1 text-xs opacity-90">{this.state.error.message}</p>
              <p className="mt-2 text-xs opacity-80">
                Volte ao preset <strong>Rua</strong> no player ou recarregue a página.
              </p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
