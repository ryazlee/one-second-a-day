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

  // Local `next dev` uses the Next.js route handler.
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

export async function fetchVideoBlob(
  video: MediaItem,
  accessToken: string
): Promise<Blob> {
  const cached = blobCache.get(video.id);
  if (cached) return cached;

  const target = `${video.mediaFile.baseUrl}=dv`;
  const proxyUrl = mediaProxyEndpoint(target);

  const res = await fetch(proxyUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch video (${res.status})`);
  }

  const blob = await res.blob();
  blobCache.set(video.id, blob);
  return blob;
}

export function clearVideoBlobCache() {
  blobCache.clear();
}
