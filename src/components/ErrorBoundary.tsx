import { Component, type ReactNode } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  showDetails: boolean;
  showAdvanced: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetails: false, showAdvanced: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false, showAdvanced: false };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary] caught:', error?.message, error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Go to store root if inside a /:slug route, else to /
    const parts = window.location.pathname.split('/').filter(Boolean);
    const target = parts[0] ? `/${parts[0]}` : '/';
    window.location.href = target;
  };

  handleHardClear = async () => {
    if (!confirm('Isso vai apagar seu carrinho e desconectar você. Continuar?')) return;
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
    } finally {
      window.location.href = window.location.origin + window.location.pathname;
    }
  };

  render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || 'Erro desconhecido';
      const errStack = this.state.error?.stack || '';
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <RefreshCw className="h-8 w-8 text-red-600" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Ops! Algo deu errado
              </h1>
              <p className="text-gray-500">
                Tente recarregar a página. Seu carrinho e seus dados serão preservados.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-medium text-white shadow-md transition hover:bg-blue-700 active:scale-95"
              >
                Recarregar página
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50 active:scale-95"
              >
                Voltar à loja
              </button>
            </div>

            <button
              onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${this.state.showDetails ? 'rotate-180' : ''}`}
              />
              {this.state.showDetails ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
            </button>

            {this.state.showDetails && (
              <div className="rounded-lg bg-gray-100 p-3 text-left">
                <p className="text-xs font-semibold text-gray-700">Mensagem:</p>
                <p className="mb-2 break-words text-xs text-red-700">{errMsg}</p>
                {errStack && (
                  <details>
                    <summary className="cursor-pointer text-xs text-gray-600">Stack</summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] text-gray-600">
                      {errStack}
                    </pre>
                  </details>
                )}
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard?.writeText(`${errMsg}\n\n${errStack}`);
                      alert('Detalhes copiados!');
                    } catch {}
                  }}
                  className="mt-2 text-xs text-blue-600 underline"
                >
                  Copiar detalhes
                </button>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={this.handleHardClear}
                className="text-[11px] text-gray-400 underline hover:text-red-600"
              >
                Último recurso: limpar tudo (apaga carrinho e desconecta)
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Se o problema persistir após limpar o cache, entre em contato com o suporte.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
