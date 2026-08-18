import { MediaItem } from "@/src/types/types";
import { getBasePath } from "@/src/lib/googleClient";
import { ensureFreshToken, peekAccessToken } from "@/src/lib/authToken";
import { fetchWithRetry, friendlyHttpError, wait } from "@/src/lib/http";
import {
  latestMediaItem,
  refreshMediaItem,
  videoProcessingStatus,
} from "@/src/lib/mediaRegistry";

const blobCache = new Map<string, Blob>();
const inflight = new Map<string, Promise<Blob>>();

const MAX_CONCURRENT_DOWNLOADS = 2;
let activeDownloads = 0;
const downloadWaiters: (() => void)[] = [];

async function withDownloadSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    await new Promise<void>((resolve) => downloadWaiters.push(resolve));
  }
  activeDownloads += 1;
  try {
    return await fn();
  } finally {
    activeDownloads -= 1;
    downloadWaiters.shift()?.();
  }
}

function mediaProxyEndpoint(target: string): string {
  const external = process.env.NEXT_PUBLIC_MEDIA_PROXY_URL?.trim().replace(
    /\/$/,
    ""
  );
  if (external) {
    return `${external}?url=${encodeURIComponent(target)}`;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `${getBasePath()}/api/photos/proxy?url=${encodeURIComponent(target)}`;
    }
  }

  throw new Error(
    "Video proxy is not configured. Set NEXT_PUBLIC_MEDIA_PROXY_URL to your Cloudflare Worker URL and redeploy."
  );
}

function downloadUrlFor(item: MediaItem): string {
  const base = item.mediaFile.baseUrl;
  if (item.type === "PHOTO") {
    // Sized JPEG, not original HEIC — Chrome can't decode iPhone originals.
    return `${base}=w1920-h1920`;
  }
  return `${base}=dv`;
}

export function previewUrlFor(item: MediaItem): string {
  const base = item.mediaFile.baseUrl;
  if (item.type === "PHOTO") {
    return `${base}=w720-h1280`;
  }
  return `${base}=w720-h1280-no`;
}

function looksLikeMediaBlob(blob: Blob, kind: "photo" | "video"): boolean {
  if (blob.size < 64) return false;
  const type = (blob.type || "").toLowerCase();
  if (type.includes("json") || type.includes("text/html") || type.includes("text/plain")) {
    return false;
  }
  if (kind === "photo") {
    return (
      !type ||
      type.startsWith("image/") ||
      type === "application/octet-stream"
    );
  }
  return (
    !type ||
    type.startsWith("video/") ||
    type === "application/octet-stream" ||
    type === "application/mp4"
  );
}

async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const data = (await res.clone().json()) as { error?: string };
    return typeof data?.error === "string" ? data.error : null;
  } catch {
    return null;
  }
}

async function downloadViaProxy(
  targetUrl: string,
  accessToken: string,
  kind: "photo" | "video"
): Promise<Blob> {
  const proxyUrl = mediaProxyEndpoint(targetUrl);
  const res = await fetchWithRetry(proxyUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeoutMs: kind === "video" ? 120_000 : 45_000,
    retries: 3,
    retryOn: (response) =>
      response.status === 404 ||
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500,
  });

  if (!res.ok) {
    const detail = await readErrorMessage(res);
    throw new Error(detail || friendlyHttpError(res.status, kind));
  }

  const blob = await res.blob();
  if (!looksLikeMediaBlob(blob, kind)) {
    throw new Error(
      kind === "photo"
        ? "Google Photos returned an unreadable photo"
        : "Google Photos returned an unreadable video"
    );
  }
  return blob;
}

async function downloadItem(
  item: MediaItem,
  accessToken: string
): Promise<Blob> {
  const kind = item.type === "PHOTO" ? "photo" : "video";
  const status = videoProcessingStatus(item);

  if (status === "FAILED") {
    throw new Error("Google Photos failed to process this clip");
  }

  if (status === "PROCESSING") {
    await wait(1500);
  }

  return downloadViaProxy(downloadUrlFor(item), accessToken, kind);
}

export async function fetchVideoBlob(
  item: MediaItem,
  accessToken: string
): Promise<Blob> {
  const cached = blobCache.get(item.id);
  if (cached) return cached;

  const existing = inflight.get(item.id);
  if (existing) return existing;

  const task = withDownloadSlot(async () => {
    let token = (await ensureFreshToken()) || accessToken || peekAccessToken();
    if (!token) throw new Error("Not signed in");

    let current = latestMediaItem(item);
    let lastError: unknown;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const blob = await downloadItem(current, token);
        blobCache.set(item.id, blob);
        return blob;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : "";
        const expired =
          message.includes("401") ||
          message.includes("403") ||
          /expired|sign in/i.test(message);

        if (expired) {
          token = (await ensureFreshToken({ force: true })) || token;
          try {
            current = await refreshMediaItem(current);
          } catch {
            // keep current url
          }
        }

        if (attempt < 3) await wait(500 * 2 ** attempt);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to download media");
  });

  inflight.set(item.id, task);
  try {
    return await task;
  } finally {
    inflight.delete(item.id);
  }
}

const previewCache = new Map<string, string>();
const previewInflight = new Map<string, Promise<string>>();

export async function fetchPreviewObjectUrl(
  item: MediaItem,
  accessToken: string
): Promise<string> {
  const cached = previewCache.get(item.id);
  if (cached) return cached;

  const existing = previewInflight.get(item.id);
  if (existing) return existing;

  const task = (async () => {
    const token = (await ensureFreshToken()) || accessToken;
    const current = latestMediaItem(item);
    const kind = current.type === "PHOTO" ? "photo" : "video";
    const blob = await downloadViaProxy(previewUrlFor(current), token, "photo");
    if (!looksLikeMediaBlob(blob, "photo")) {
      throw new Error(`Couldn’t load ${kind} preview`);
    }
    const url = URL.createObjectURL(blob);
    previewCache.set(item.id, url);
    return url;
  })();

  previewInflight.set(item.id, task);
  try {
    return await task;
  } catch (error) {
    previewInflight.delete(item.id);
    throw error;
  } finally {
    previewInflight.delete(item.id);
  }
}

export function clearVideoBlobCache() {
  blobCache.clear();
  inflight.clear();
  for (const url of previewCache.values()) {
    URL.revokeObjectURL(url);
  }
  previewCache.clear();
  previewInflight.clear();
}
