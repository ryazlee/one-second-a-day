import { MediaItem } from "@/src/types/types";

const blobCache = new Map<string, Blob>();

function mediaProxyEndpoint(target: string): string {
  const external = process.env.NEXT_PUBLIC_MEDIA_PROXY_URL?.replace(/\/$/, "");
  if (external) {
    return `${external}?url=${encodeURIComponent(target)}`;
  }
  // Local `next dev` uses the Next.js route handler.
  return `/api/photos/proxy?url=${encodeURIComponent(target)}`;
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
