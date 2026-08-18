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
    callback: (response: {
      access_token?: string;
      expires_in?: number | string;
      error?: string;
    }) => void;
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

export async function requestGoogleAccessToken(
  prompt: "" | "consent" = "consent"
): Promise<{ accessToken: string; expiresIn: number }> {
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
        const raw = response.expires_in;
        const expiresIn =
          typeof raw === "number"
            ? raw
            : typeof raw === "string"
              ? Number(raw)
              : 3600;
        resolve({
          accessToken: response.access_token,
          expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600,
        });
      },
    });
    client.requestAccessToken({ prompt });
  });
}

import { fetchWithRetry } from "@/src/lib/http";
import { MediaItem } from "@/src/types/types";

async function googleJson<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetchWithRetry(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    timeoutMs: 20_000,
    retries: 3,
  });
  if (!res.ok) {
    throw new Error(`Google Photos request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function createPickerSession(accessToken: string) {
  return googleJson<{ id: string; pickerUri: string }>(
    "https://photospicker.googleapis.com/v1/sessions",
    accessToken,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function getPickerSession(accessToken: string, sessionId: string) {
  return googleJson<{ mediaItemsSet?: boolean }>(
    `https://photospicker.googleapis.com/v1/sessions/${sessionId}`,
    accessToken
  );
}

export async function listPickerMediaItems(
  accessToken: string,
  sessionId: string
): Promise<{ mediaItems: MediaItem[] }> {
  const mediaItems: MediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      sessionId,
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await googleJson<{
      mediaItems?: MediaItem[];
      nextPageToken?: string;
    }>(
      `https://photospicker.googleapis.com/v1/mediaItems?${params.toString()}`,
      accessToken
    );

    mediaItems.push(...(data.mediaItems || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { mediaItems };
}
