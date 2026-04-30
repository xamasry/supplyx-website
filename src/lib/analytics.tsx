import React, { useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A lightweight analytics tracking module simulating event dispatch.
 * In a real production deployment, this would push events to Firebase Analytics or Mixpanel.
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (import.meta.env.MODE !== 'production') {
    console.debug(`[Analytics Tracker] Event: ${eventName}`, params);
  } else {
    // Simulated production logging
    console.log(`Analytics[${eventName}]`, JSON.stringify(params));
  }
};

export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_view', {
      path: location.pathname,
      search: location.search
    });
  }, [location]);
};

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useAnalytics();
  return <>{children}</>;
}
