'use client';

import { useEffect } from 'react';

export function TitleSetter({ title }: { title: string }) {
  useEffect(() => {
    document.title = title ? `${title} - Jeevandata` : 'Jeevandata';
  }, [title]);

  return null;
}
