"use client";

import { AppHeader } from "@/src/components/AppHeader";
import { SiteFooter } from "@/src/components/SiteFooter";
import { ThemeProvider } from "@/src/theme";
import { trackPageview } from "@/src/utils/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function RouteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  return null;
}

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
        <RouteAnalytics />
        <div className="app-shell">
          <AppHeader />
          {children}
          <SiteFooter />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
