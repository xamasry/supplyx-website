import React, { useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { monitor, EventType } from './monitor';
import ErrorBoundary from '../components/ErrorBoundary';
import { db } from './firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

/**
 * Enhanced analytics tracking module logging to Firestore.
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  monitor.logEvent(EventType.CLICK, eventName, params);
};

/**
 * Normalizes a path for use as a Firestore document ID.
 * Replaces slashes with dashes and removes leading/trailing slashes.
 */
function normalizePath(path: string): string {
  let normalized = path.startsWith('/') ? path.slice(1) : path;
  normalized = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  normalized = normalized === '' ? 'home' : normalized.replace(/\//g, '-');
  return normalized;
}

/**
 * Tracks a page visit persistently.
 */
export async function trackPageView(path: string) {
  const pathId = normalizePath(path);
  const docRef = doc(db, 'page_stats', pathId);
  try {
    await setDoc(docRef, {
      path,
      visits: increment(1),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Analytics trackPageView Error:', error);
  }
}

/**
 * Tracks a click on a page element persistently.
 */
export async function trackPageClick(path: string) {
  const pathId = normalizePath(path);
  const docRef = doc(db, 'page_stats', pathId);
  try {
    await setDoc(docRef, {
      path,
      clicks: increment(1),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Analytics trackPageClick Error:', error);
  }
}

/**
 * Tracks interaction with a specific offer persistently.
 */
export async function trackOfferInteraction(
  offerId: string, 
  type: 'view' | 'click', 
  offerInfo?: { title?: string; supplierName?: string }
) {
  if (!offerId) return;
  const docRef = doc(db, 'offer_stats', offerId);
  try {
    const updateData: any = {
      offerId,
      updatedAt: serverTimestamp()
    };
    if (type === 'view') {
      updateData.views = increment(1);
    } else {
      updateData.clicks = increment(1);
    }
    if (offerInfo?.title) updateData.offerTitle = offerInfo.title;
    if (offerInfo?.supplierName) updateData.supplierName = offerInfo.supplierName;

    await setDoc(docRef, updateData, { merge: true });
  } catch (error) {
    console.error('Analytics trackOfferInteraction Error:', error);
  }
}

export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    monitor.logPageView(document.title || location.pathname);
    trackPageView(location.pathname);
  }, [location]);

  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      monitor.logSessionHeartbeat();
    }, 60000);

    let maxScroll = 0;
    const handleScroll = () => {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);
      
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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const info = {
            id: target.id || null,
            tag: target.tagName,
            text: (target.innerText || target.textContent || '').substring(0, 30),
            x: e.clientX,
            y: e.clientY
        };
        monitor.logClick(`Click: ${target.tagName}`, info);
        trackPageClick(location.pathname);
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [location.pathname]);
};

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useAnalytics();
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
