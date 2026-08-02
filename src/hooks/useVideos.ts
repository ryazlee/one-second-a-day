import { useQuery } from "@tanstack/react-query";
import { listPickerMediaItems } from "@/src/lib/googleClient";
import { MediaItem } from "@/src/types/types";

export const EMPTY_MEDIA: MediaItem[] = [];

async function fetchMediaItems(
  accessToken: string,
  sessionId: string
): Promise<MediaItem[]> {
  const data = await listPickerMediaItems(accessToken, sessionId);
  return (data.mediaItems || []).filter(
    (item: MediaItem) =>
      (item?.type === "VIDEO" || item?.type === "PHOTO") &&
      item?.id &&
      item?.mediaFile?.baseUrl
  );
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
    retry: 1,
  });
}
