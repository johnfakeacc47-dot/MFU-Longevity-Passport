import React from 'react';
import '../styles/ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

// App-wide safety net. Without this, any uncaught render error anywhere in the
// tree (e.g. a corrupted value read from localStorage) unmounts the entire app
// and leaves the user on a blank white screen with no way to recover.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled app error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-screen">
          <div className="app-error-card">
            <div className="app-error-icon">⚠️</div>
            <h1 className="app-error-title">Something went wrong</h1>
            <p className="app-error-sub">
              The app hit an unexpected error. Reloading usually fixes it.
            </p>
            <p className="app-error-detail">{this.state.message}</p>
            <button className="app-error-button" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
