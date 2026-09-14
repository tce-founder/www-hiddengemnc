import { createContext } from 'react';
import type { HeadTag } from './seo';

export interface HeadCollector {
  add(tags: HeadTag[]): void;
}

/**
 * Provided only by the prerenderer (entry-server.tsx), which collects each
 * page's head tags and writes them into the static HTML. In the browser it is
 * absent and <Seo> renders real tags that React 19 hoists into <head>.
 */
export const HeadCollectorContext = createContext<HeadCollector | undefined>(undefined);
