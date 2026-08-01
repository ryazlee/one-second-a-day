"use client";

import { AppHeader } from "@/src/components/AppHeader";
import { SiteFooter } from "@/src/components/SiteFooter";
import { ThemeProvider } from "@/src/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

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
