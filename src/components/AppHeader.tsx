"use client";

import { Button } from "@/src/components/Button";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { APP_NAME } from "@/src/content/app";
import { useAccessToken } from "@/src/hooks/useAccessToken";
import Link from "next/link";

export function AppHeader() {
  const { accessToken, setAccessToken } = useAccessToken();

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand-block">
          <Link href="/" className="brand">
            {APP_NAME}
          </Link>
        </div>
        <div className="header-actions">
          {accessToken ? (
            <Button
              label="Sign out"
              variant="ghost"
              onClick={() => setAccessToken(null)}
            />
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
