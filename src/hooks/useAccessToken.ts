"use client";

import {
  registerAuthBridge,
  setAuthState,
} from "@/src/lib/authToken";
import { requestGoogleAccessToken } from "@/src/lib/googleClient";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "osad.googleToken.v1";
const AUTH_EVENT = "osad-auth-change";

type StoredToken = {
  access_token: string;
  expires_at: number;
};

function readStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed?.access_token || typeof parsed.expires_at !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredToken(token: StoredToken | null) {
  if (!token) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  setAuthState(token?.access_token ?? null, token?.expires_at ?? 0);
  // Clear legacy session key from earlier builds.
  sessionStorage.removeItem("google_access_token");
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onStoreChange();
  };
  const onAuth = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_EVENT, onAuth);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_EVENT, onAuth);
  };
}

function getSnapshot(): string | null {
  const stored = readStoredToken();
  if (!stored) return null;
  setAuthState(stored.access_token, stored.expires_at);
  // Expose token even if near-expiry; restore effect refreshes it.
  return stored.access_token;
}

function getServerSnapshot() {
  return null;
}

export function useAccessToken() {
  const accessToken = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [authReady, setAuthReady] = useState(false);

  const setAccessToken = useCallback(
    (token: string | null, expiresInSeconds = 3600) => {
      if (!token) {
        writeStoredToken(null);
        return;
      }
      writeStoredToken({
        access_token: token,
        expires_at:
          Date.now() + Math.max(60, expiresInSeconds) * 1000,
      });
    },
    []
  );

  useEffect(() => {
    registerAuthBridge({
      refresher: () => requestGoogleAccessToken(""),
      persist: (nextToken, expiresIn) => setAccessToken(nextToken, expiresIn),
    });
  }, [setAccessToken]);

  // Persist across reloads: reuse fresh token or silently refresh.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = readStoredToken();
      if (!stored) {
        if (!cancelled) setAuthReady(true);
        return;
      }

      const stillFresh = stored.expires_at > Date.now() + 60_000;
      if (stillFresh) {
        if (!cancelled) setAuthReady(true);
        return;
      }

      try {
        const next = await requestGoogleAccessToken("");
        if (cancelled) return;
        setAccessToken(next.accessToken, next.expiresIn);
      } catch {
        if (!cancelled) writeStoredToken(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [setAccessToken]);

  // Refresh ~2 minutes before expiry so long trim/export sessions don't 401.
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored || !accessToken) return;
    const delay = Math.max(5_000, stored.expires_at - Date.now() - 120_000);
    const timer = window.setTimeout(() => {
      void requestGoogleAccessToken("")
        .then((next) => setAccessToken(next.accessToken, next.expiresIn))
        .catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [accessToken, setAccessToken]);

  return { accessToken, setAccessToken, authReady };
}
