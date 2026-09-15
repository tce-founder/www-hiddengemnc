import { BrowserRouter, Route, Routes } from 'react-router';
import { SiteLayout } from './components/layout/SiteLayout';
import { ScrollToTop } from './components/ScrollToTop';
import { Toaster } from './components/ui/sonner';
import NotFoundPage from './pages/NotFoundPage';
import { siteRoutes } from './routes';

/**
 * The app minus the router, shared by the browser (BrowserRouter, below) and
 * the prerenderer (MemoryRouter, entry-server.tsx).
 */
export function AppShell() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          {siteRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
