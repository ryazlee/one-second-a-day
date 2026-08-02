import { MediaItem } from "@/src/types/types";
import { getBasePath } from "@/src/lib/googleClient";

const blobCache = new Map<string, Blob>();

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
  // Picker baseUrl download params: videos use =dv, photos use =d.
  return item.type === "PHOTO" ? `${base}=d` : `${base}=dv`;
}

export async function fetchVideoBlob(
  item: MediaItem,
  accessToken: string
): Promise<Blob> {
  const cached = blobCache.get(item.id);
  if (cached) return cached;

  const proxyUrl = mediaProxyEndpoint(downloadUrlFor(item));

  const res = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${item.type === "PHOTO" ? "photo" : "video"} (${res.status})`
    );
  }

  const blob = await res.blob();
  blobCache.set(item.id, blob);
  return blob;
}

export function clearVideoBlobCache() {
  blobCache.clear();
}
