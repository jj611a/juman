import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Renderer error boundary', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">حدث خطأ غير متوقع</h1>
          <p className="max-w-lg text-muted-foreground">{this.state.message}</p>
          <Button type="button" onClick={() => window.location.assign('/')}>
            العودة للرئيسية
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
