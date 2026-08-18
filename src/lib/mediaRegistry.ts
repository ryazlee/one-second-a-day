import { listPickerMediaItems } from "@/src/lib/googleClient";
import { MediaItem } from "@/src/types/types";
import { ensureFreshToken } from "@/src/lib/authToken";

let sessionId: string | null = null;
const itemsById = new Map<string, MediaItem>();
let refreshInFlight: Promise<void> | null = null;

export function rememberMediaSession(
  nextSessionId: string,
  items: MediaItem[]
) {
  sessionId = nextSessionId;
  for (const item of items) itemsById.set(item.id, item);
}

export function latestMediaItem(item: MediaItem): MediaItem {
  return itemsById.get(item.id) ?? item;
}

/** Re-list picker items so expired 60-minute baseUrls get replaced. */
export async function refreshMediaItem(item: MediaItem): Promise<MediaItem> {
  if (!sessionId) return latestMediaItem(item);

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const token = await ensureFreshToken({ force: true });
        if (!token || !sessionId) return;
        const data = await listPickerMediaItems(token, sessionId);
        rememberMediaSession(sessionId, data.mediaItems || []);
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  await refreshInFlight;
  return latestMediaItem(item);
}

export function videoProcessingStatus(
  item: MediaItem
): "UNSPECIFIED" | "PROCESSING" | "READY" | "FAILED" | undefined {
  const fileMeta = item.mediaFile?.mediaFileMetadata;
  const fromVideo = fileMeta?.videoMetadata?.processingStatus;
  if (fromVideo) return fromVideo;

  const extra = item as MediaItem & {
    mediaMetadata?: { status?: string };
  };
  const status = extra.mediaMetadata?.status;
  if (
    status === "PROCESSING" ||
    status === "READY" ||
    status === "FAILED" ||
    status === "UNSPECIFIED"
  ) {
    return status;
  }
  return undefined;
}
