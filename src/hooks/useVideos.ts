import { useQuery } from "@tanstack/react-query";
import { ensureFreshToken } from "@/src/lib/authToken";
import { listPickerMediaItems } from "@/src/lib/googleClient";
import { rememberMediaSession } from "@/src/lib/mediaRegistry";
import { MediaItem } from "@/src/types/types";

export const EMPTY_MEDIA: MediaItem[] = [];

async function fetchMediaItems(
  accessToken: string,
  sessionId: string
): Promise<MediaItem[]> {
  const token = (await ensureFreshToken()) || accessToken;
  const data = await listPickerMediaItems(token, sessionId);
  const items = (data.mediaItems || []).filter(
    (item: MediaItem) =>
      (item?.type === "VIDEO" || item?.type === "PHOTO") &&
      item?.id &&
      item?.mediaFile?.baseUrl
  );
  rememberMediaSession(sessionId, items);
  return items;
}

/** @deprecated Prefer EMPTY_MEDIA — kept for any lingering imports. */
export const EMPTY_VIDEOS = EMPTY_MEDIA;

export function useVideos(
  accessToken: string | null,
  sessionId: string | null
) {
  return useQuery({
    queryKey: ["media", sessionId],
    queryFn: () => fetchMediaItems(accessToken!, sessionId!),
    enabled: Boolean(accessToken && sessionId),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 3,
  });
}
