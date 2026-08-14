'use client';

import { useEffect } from 'react';

/**
 * Sets `document.title` for client-rendered pages (which can't export
 * Next.js `metadata`). Uses the root layout's "%s | Jeevandata" template
 * convention so every tab reads "Page Name | Jeevandata".
 */
export function TitleSetter({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} | Jeevandata`;
  }, [title]);
  return null;
}
