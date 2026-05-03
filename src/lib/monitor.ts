import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export enum EventType {
  PAGE_VIEW = 'page_view',
  CLICK = 'click',
  FORM_SUBMISSION = 'form_submission',
  ERROR = 'error',
  PERFORMANCE = 'performance',
  CONVERSION = 'conversion',
}

export interface MonitoringEvent {
  type: EventType;
  name: string;
  data?: any;
  path: string;
  userId?: string | null;
  userAgent: string;
  timestamp: any;
  sessionId: string;
}

// Simple session ID generator
const session_id = Math.random().toString(36).substring(2, 15);

class Monitor {
  private static instance: Monitor;
  private isEnabled: boolean = true;
  private sessionStartTime: number = Date.now();

  private constructor() {
    this.setupGlobalHandlers();
  }

  public static getInstance(): Monitor {
    if (!Monitor.instance) {
      Monitor.instance = new Monitor();
    }
    return Monitor.instance;
  }

  private setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Capture unhandled promise rejections
    window.onunhandledrejection = (event) => {
      this.logError('Unhandled Promise Rejection', {
        reason: event.reason,
      });
    };

    // Capture global errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.logError('Global Window Error', {
        message,
        source,
        lineno,
        colno,
        stack: error?.stack,
      });
    };

    // Track performance on load
    window.addEventListener('load', () => {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      this.logPerformance('Page Load', { loadTimeMs: pageLoadTime });
    });
  }

  public async logEvent(type: EventType, name: string, data?: any) {
    if (!this.isEnabled) return;

    const event: MonitoringEvent = {
        type,
        name,
        data,
        path: window.location.pathname,
        userId: auth.currentUser?.uid || null,
        userAgent: navigator.userAgent,
        timestamp: serverTimestamp(),
        sessionId: session_id,
    };

    try {
      await addDoc(collection(db, 'system_logs'), event);
    } catch (err) {
      // Fail silently to not impact user experience
      console.error('Monitoring Error:', err);
    }
  }

  public logPageView(title: string) {
    this.logEvent(EventType.PAGE_VIEW, title);
  }

  public logClick(elementId: string, metadata?: any) {
    this.logEvent(EventType.CLICK, elementId, metadata);
  }

  public logError(message: string, error?: any) {
    this.logEvent(EventType.ERROR, message, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : null,
    });
    
    // High alert logic
    if (message.toLowerCase().includes('critical') || message.toLowerCase().includes('failed to fetch')) {
        this.triggerCriticalAlert(message, error);
    }
  }

  public logPerformance(name: string, metrics: any) {
    this.logEvent(EventType.PERFORMANCE, name, metrics);
  }

  public logSessionHeartbeat() {
    const timeSpent = Date.now() - this.sessionStartTime;
    this.logEvent(EventType.PERFORMANCE, 'Session Heartbeat', { 
      timeSpentSeconds: Math.floor(timeSpent / 1000),
      isHeartbeat: true
    });
  }

  public logScrollDepth(depthPercent: number) {
    this.logEvent(EventType.CLICK, 'Scroll Depth', { depthPercent });
  }

  public logConversion(conversionType: string, value?: number) {
    this.logEvent(EventType.CONVERSION, conversionType, { value });
  }

  private triggerCriticalAlert(message: string, data: any) {
      // In a real production app, this would call a Slack or SendGrid webhook.
      // For now, we log it to a special collection for the Admin dashboard to watch.
      addDoc(collection(db, 'system_alerts'), {
          message,
          data,
          path: window.location.pathname,
          timestamp: serverTimestamp(),
          severity: 'critical'
      });
  }
}

export const monitor = Monitor.getInstance();
