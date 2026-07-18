import { MediaItem } from "@/src/types/types";

const blobCache = new Map<string, Blob>();

export async function fetchVideoBlob(
  video: MediaItem,
  accessToken: string
): Promise<Blob> {
  const cached = blobCache.get(video.id);
  if (cached) return cached;

  const proxyUrl = `/api/photos/proxy?url=${encodeURIComponent(
    video.mediaFile.baseUrl + "=dv"
  )}`;

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
