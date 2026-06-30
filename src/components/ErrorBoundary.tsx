import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  resetKey?: unknown
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na renderização:', error, info.componentStack)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full min-h-[60vh] p-4">
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h2 className="font-heading text-lg font-bold text-[var(--text)] mb-2">Algo deu errado</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Ocorreu um erro ao carregar esta tela. Tente novamente ou navegue para outra página.
            </p>
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
