import { useQuery } from "@tanstack/react-query";
import { listPickerMediaItems } from "@/src/lib/googleClient";
import { MediaItem } from "@/src/types/types";

export const EMPTY_VIDEOS: MediaItem[] = [];

async function fetchVideos(
  accessToken: string,
  sessionId: string
): Promise<MediaItem[]> {
  const data = await listPickerMediaItems(accessToken, sessionId);
  const videos = (data.mediaItems || []).filter(
    (item: MediaItem) => item?.type === "VIDEO" && item?.id && item?.mediaFile?.baseUrl
  );
  return videos;
}

export function useVideos(
  accessToken: string | null,
  sessionId: string | null
) {
  return useQuery({
    queryKey: ["videos", sessionId],
    queryFn: () => fetchVideos(accessToken!, sessionId!),
    enabled: Boolean(accessToken && sessionId),
    // Picker session results are immutable once set.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}
