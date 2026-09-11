import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installKidSafeGuardrails } from './lib/guardrails';
import './fonts.css';
import './styles.css';
import './puzzles.css';

installKidSafeGuardrails();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing || sessionStorage.getItem('pwa-controller-refreshed') === 'true') return;
      refreshing = true;
      sessionStorage.setItem('pwa-controller-refreshed', 'true');
      window.location.reload();
    });
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then((registration) => registration.update()).catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
