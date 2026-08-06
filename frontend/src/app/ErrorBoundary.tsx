import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI ErrorBoundary', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="card w-full max-w-lg border border-error/30 bg-base-200">
            <div className="card-body gap-3">
              <h2 className="card-title text-error">
                {this.props.fallbackTitle ?? 'تعذّر عرض هذه الشاشة'}
              </h2>
              <p className="text-sm text-base-content/70" dir="ltr">
                {this.state.error.message}
              </p>
              <div className="card-actions justify-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => this.setState({ error: null })}
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
