import { useQuery } from "@tanstack/react-query";
import { listPickerMediaItems } from "@/src/lib/googleClient";
import { MediaItem } from "@/src/types/types";

async function fetchVideos(
  accessToken: string,
  sessionId: string
): Promise<MediaItem[]> {
  const data = await listPickerMediaItems(accessToken, sessionId);
  const videos = (data.mediaItems || []).filter(
    (item: MediaItem) => item.type === "VIDEO"
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
    enabled: !!accessToken && !!sessionId,
  });
}
