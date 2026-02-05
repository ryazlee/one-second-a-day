// src/hooks/useVideos.ts
import { useQuery } from "@tanstack/react-query";
import { MediaItem } from "@/src/types/types";

async function fetchVideos(
  accessToken: string,
  sessionId: string
): Promise<MediaItem[]> {
  const res = await fetch(`/api/photos/picker/media-items/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch media items");
  }

  const data = await res.json();
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