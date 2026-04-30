import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// @ts-ignore
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    // @ts-ignore
    const { hasError, error } = this.state;
    // @ts-ignore
    const { fallback, children } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }
      return (
        <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', fontFamily: 'sans-serif', margin: '20px', borderRadius: '8px' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {error && error.toString()}
          </details>
        </div>
      );
    }

    return children;
  }
}
