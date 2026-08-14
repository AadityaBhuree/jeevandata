'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { LanguageProvider } from '@/hooks/useLanguage';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { Toaster } from '@/components/ui/toaster';
import { initOfflineSync } from '@/services/sync';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes
            retry: 2,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  // ─── Offline sync: connectivity listeners + queued-mutation count ───
  useEffect(() => {
    return initOfflineSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <OfflineIndicator />
          {children}
          <Toaster />
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
