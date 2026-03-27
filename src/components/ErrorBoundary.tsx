import { Component, type ReactNode } from 'react';
import CacheBuster from './CacheBuster';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <RefreshCw className="h-8 w-8 text-red-600" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Ops! Algo deu errado
              </h1>
              <p className="text-gray-500">
                Pode ser que o seu navegador esteja com uma versão antiga em cache.
                Clique no botão abaixo para limpar e carregar a versão mais recente.
              </p>
            </div>

            <CacheBuster />

            <p className="text-xs text-gray-400 mt-8">
              Se o problema persistir após limpar o cache, entre em contato com o suporte.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
