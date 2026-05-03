import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { NetworkIndicator } from './components/NetworkIndicator';
import { setupModuleErrorHandler } from './lib/moduleErrorHandler';

// Handle dynamic import failures
setupModuleErrorHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <NetworkIndicator />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
