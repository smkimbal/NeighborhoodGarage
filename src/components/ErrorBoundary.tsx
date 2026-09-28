import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Wrench, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Neighborhood Garage caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center font-black">
              <Wrench className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white">Neighborhood Garage</h2>
            <p className="text-xs text-slate-300">
              The application encountered a startup glitch. Click below to reload.
            </p>
            {this.state.error && (
              <pre className="text-[11px] text-amber-300/80 bg-slate-950 p-3 rounded-xl overflow-x-auto text-left border border-slate-800">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 mx-auto transition shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Neighborhood Garage</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
