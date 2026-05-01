import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Handle Vite/SystemJS/Browser Chunk Load Errors
    const chunkFailedMessage = /Loading chunk [\d]+ failed|Importing a module script failed|Failed to fetch dynamically imported module/i;
    if (chunkFailedMessage.test(error.message) || chunkFailedMessage.test(error.toString())) {
      console.warn("Chunk load failure detected. Reloading page...");
      window.location.reload();
    }
  }

  public render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      // Check if it's a chunk error for the render too
      const errorMsg = error?.toString() || "";
      const isChunkError = /Loading chunk [\d]+ failed|Importing a module script failed|Failed to fetch dynamically imported module/i.test(errorMsg);

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-right font-sans" dir="rtl">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-xl border border-slate-200 text-center">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">عذراً، حدث خطأ ما</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {isChunkError 
                ? "يوجد تحديث جديد للتطبيق متوفر حالياً. يرجى إعادة التحميل."
                : "واجهنا مشكلة تقنية بسيطة، يمكنك المحاولة مرة أخرى أو العودة للرئيسية."}
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all"
              >
                إعادة المحميل الآن
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl transition-all"
              >
                العودة للرئيسية
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-8 text-left text-[10px] text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100 overflow-auto max-h-40">
                <summary className="cursor-pointer mb-2 font-bold uppercase tracking-widest">Details (Dev Only)</summary>
                <div className="whitespace-pre-wrap">{errorMsg}</div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}
