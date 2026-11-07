import React from 'react';
import '../styles/ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

// This boundary wraps <App> in main.tsx — i.e. it sits OUTSIDE the
// LanguageProvider — so it can't use useLanguage(). Read the same persisted
// 'language' key the provider uses and pick the strings by hand.
const STRINGS = {
  en: {
    title: 'Something went wrong',
    sub: 'The app hit an unexpected error. Reloading usually fixes it.',
    reload: 'Reload',
    unknown: 'Unknown error',
  },
  th: {
    title: 'เกิดข้อผิดพลาดบางอย่าง',
    sub: 'แอปพบข้อผิดพลาดที่ไม่คาดคิด โดยปกติการโหลดใหม่จะช่วยแก้ปัญหาได้',
    reload: 'โหลดใหม่',
    unknown: 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ',
  },
} as const;

function getStrings() {
  try {
    return localStorage.getItem('language') === 'th' ? STRINGS.th : STRINGS.en;
  } catch {
    return STRINGS.en;
  }
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
    return { hasError: true, message: error.message || getStrings().unknown };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled app error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const s = getStrings();
      return (
        <div className="app-error-screen" role="alert">
          <div className="app-error-card">
            <div className="app-error-icon" aria-hidden="true">⚠️</div>
            <h1 className="app-error-title">{s.title}</h1>
            <p className="app-error-sub">{s.sub}</p>
            <p className="app-error-detail">{this.state.message}</p>
            <button type="button" className="app-error-button" onClick={this.handleReload}>
              {s.reload}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
