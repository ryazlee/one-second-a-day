import { MediaItem } from "@/src/types/types";
import { dayKeyFromIso } from "@/src/lib/dates";

export function groupVideosByDay(videos: MediaItem[]): Record<string, MediaItem[]> {
  const map: Record<string, MediaItem[]> = {};

  for (const video of videos) {
    const dayKey = dayKeyFromIso(video.createTime);
    if (!map[dayKey]) map[dayKey] = [];
    map[dayKey].push(video);
  }

  Object.values(map).forEach((list) =>
    list.sort(
      (a, b) =>
        new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
    )
  );

  return map;
}
