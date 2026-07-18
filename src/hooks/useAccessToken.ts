"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "google_access_token";
const AUTH_EVENT = "osad-auth-change";

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

function getSnapshot() {
  return sessionStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function useAccessToken() {
  const accessToken = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setAccessToken = useCallback((token: string | null) => {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
    notifyAuthChange();
  }, []);

  return { accessToken, setAccessToken };
}
