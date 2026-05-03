import React, { Component, ErrorInfo, ReactNode } from 'react';
import { monitor } from '../lib/monitor';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    monitor.logError('React Component Crash', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center mb-6">
            <AlertCircle size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2 font-display">عذراً! حدث خطأ غير متوقع</h1>
          <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
            لقد حدث خطأ في النظام. تم تسجيل تفاصيل الخطأ وبدأنا في إصلاحه. يمكنك محاولة تحديث الصفحة.
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20"
          >
            <RefreshCw size={20} />
            تحديث الصفحة
          </button>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-12 text-left bg-slate-100 p-4 rounded-xl max-w-full overflow-auto">
                <p className="font-mono text-xs text-red-600">{this.state.error?.toString()}</p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
