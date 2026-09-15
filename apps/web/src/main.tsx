import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initAnalytics } from './lib/analytics';
import './styles/globals.css';

// The prerendered head tags (data-seo) describe the page as built. React takes
// over from here and renders the live ones via <Seo>, so drop the static copies
// to avoid duplicate <title>/<meta> tags after the first navigation.
document.head.querySelectorAll('[data-seo]').forEach((element) => element.remove());

// GA4 in production builds that have a measurement ID; a no-op otherwise.
initAnalytics();

// createRoot (not hydrateRoot): React re-renders over the prerendered markup,
// which rules out hydration mismatches. The static HTML is for crawlers and
// first paint.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
