/**
 * Global handler for module loading errors.
 * This is a common issue with SPAs after a new deployment where the browser
 * tries to load a chunk that no longer exists on the server.
 */
export function setupModuleErrorHandler() {
  if (typeof window === 'undefined') return;

  const handleModuleError = (event: ErrorEvent | PromiseRejectionEvent) => {
    const error = 'reason' in event ? event.reason : event.error;
    const message = error?.message || error?.toString() || '';
    
    // Check for common module/chunk loading error messages
    const isModuleError = 
      /Loading chunk [\d]+ failed/i.test(message) ||
      /Importing a module script failed/i.test(message) ||
      /Failed to fetch dynamically imported module/i.test(message) ||
      (event instanceof ErrorEvent && event.message === 'Script error.');

    if (isModuleError) {
      console.warn('Module loading error detected, attempting to recover by reloading page...', message);
      
      // Don't reload immediately if we just reloaded in the last 10 seconds to avoid loops
      const lastReload = sessionStorage.getItem('last-module-error-reload');
      const now = Date.now();
      
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        sessionStorage.setItem('last-module-error-reload', now.toString());
        window.location.reload();
      } else {
        console.error('Module error reload loop detected. Stopping auto-reload.');
      }
    }
  };

  window.addEventListener('error', handleModuleError, true);
  window.addEventListener('unhandledrejection', handleModuleError);

  return () => {
    window.removeEventListener('error', handleModuleError, true);
    window.removeEventListener('unhandledrejection', handleModuleError);
  };
}
