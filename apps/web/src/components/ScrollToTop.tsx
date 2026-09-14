import { useEffect } from 'react';
import { useLocation } from 'react-router';

/** Scroll to the top on page change (client-side navigation keeps scroll position otherwise). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
