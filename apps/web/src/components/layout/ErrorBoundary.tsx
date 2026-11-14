'use client';

import { AlertOctagon, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('DataScope ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {this.props.fallbackTitle || 'Something went wrong in this module'}
          </h2>
          <p className="mt-1.5 max-w-lg text-xs text-slate-600 dark:text-slate-400 font-mono">
            {this.state.errorMessage}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={this.handleReset}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reset View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
