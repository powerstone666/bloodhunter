"use client"

import { Component, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "./button"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error-container">
            <AlertTriangle className="h-6 w-6 text-on-error-container" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-on-surface">Something went wrong</h3>
          <p className="mt-2 max-w-sm text-center text-sm text-on-surface-variant">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            variant="outlined"
            className="mt-4 cursor-pointer"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
