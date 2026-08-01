"use client";

import { AppHeader } from "@/src/components/AppHeader";
import { SiteFooter } from "@/src/components/SiteFooter";
import { ensureMediaProxyWorker } from "@/src/lib/googleClient";
import { ThemeProvider } from "@/src/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  useEffect(() => {
    ensureMediaProxyWorker().catch(() => {
      // Media loads will retry registration on demand.
    });
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <div className="app-shell">
          <AppHeader />
          {children}
          <SiteFooter />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
