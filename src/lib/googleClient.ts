export const PHOTOS_SCOPE =
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

export function getGoogleClientId(): string {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!id) {
    throw new Error(
      "Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID. Add it to .env.local and GitHub Actions secrets."
    );
  }
  return id;
}

type GisTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GisOauth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: { access_token?: string; error?: string }) => void;
  }) => GisTokenClient;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOauth2 } };
  }
}

let gisLoading: Promise<void> | null = null;

export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GIS requires a browser"));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;

  gisLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-gis="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.googleGis = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });

  return gisLoading;
}

export async function requestGoogleAccessToken(): Promise<string> {
  await loadGoogleIdentity();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google Identity Services unavailable");

  const clientId = getGoogleClientId();

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: PHOTOS_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || "Google sign-in failed"));
          return;
        }
        resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export async function createPickerSession(accessToken: string) {
  const res = await fetch("https://photospicker.googleapis.com/v1/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`Failed to create picker session (${res.status})`);
  }
  return res.json() as Promise<{ id: string; pickerUri: string }>;
}

export async function getPickerSession(accessToken: string, sessionId: string) {
  const res = await fetch(
    `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to poll picker session (${res.status})`);
  }
  return res.json() as Promise<{ mediaItemsSet?: boolean }>;
}

export async function listPickerMediaItems(
  accessToken: string,
  sessionId: string
) {
  const res = await fetch(
    `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(sessionId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to list media items (${res.status})`);
  }
  return res.json();
}

export async function ensureMediaProxyWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const base = getBasePath();
  const swUrl = `${base}/sw.js`;

  const reg = await navigator.serviceWorker.register(swUrl, {
    scope: `${base}/` || "/",
  });

  if (navigator.serviceWorker.controller) return;

  await new Promise<void>((resolve) => {
    const onController = () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onController
      );
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    // Already active from a previous visit
    if (reg.active) {
      reg.active.postMessage({ type: "claim" });
    }
    window.setTimeout(() => resolve(), 1500);
  });
}
