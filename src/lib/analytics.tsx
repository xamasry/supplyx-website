import React, { useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { monitor, EventType } from './monitor';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * Enhanced analytics tracking module logging to Firestore.
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  monitor.logEvent(EventType.CLICK, eventName, params);
};

export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    monitor.logPageView(document.title || location.pathname);
  }, [location]);

  useEffect(() => {
    // Session Heartbeat - every 60 seconds (minimized frequency for data optimization)
    const heartbeatInterval = setInterval(() => {
      monitor.logSessionHeartbeat();
    }, 60000);

    // Scroll depth tracking
    let maxScroll = 0;
    const handleScroll = () => {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);
      
      // Log every 33% to avoid flood but capture meaningful progress
      if (scrollPercent > maxScroll + 33) { 
        maxScroll = scrollPercent;
        monitor.logScrollDepth(scrollPercent);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Click tracking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const info = {
            id: target.id,
            tag: target.tagName,
            text: target.innerText?.substring(0, 30),
            x: e.clientX,
            y: e.clientY
        };
        monitor.logClick(`Click: ${target.tagName}`, info);
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
};

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useAnalytics();
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
