import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

/**
 * Hook to automatically track page views on route changes.
 */
export function useAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // Only track if not in development or if specifically requested
    // For this app, we track everything as requested by user
    trackPageView(location.pathname);
  }, [location.pathname]);
}
