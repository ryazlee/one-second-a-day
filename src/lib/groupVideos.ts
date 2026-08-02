import { MediaItem } from "@/src/types/types";
import { dayKeyFromIso } from "@/src/lib/dates";

/**
 * Group picker items by calendar day. Videos win for a day; photos are used
 * only when that day has no videos (photo fallback).
 */
export function groupVideosByDay(
  items: MediaItem[]
): Record<string, MediaItem[]> {
  const raw: Record<string, MediaItem[]> = {};

  for (const item of items) {
    const dayKey = dayKeyFromIso(item.createTime);
    if (!raw[dayKey]) raw[dayKey] = [];
    raw[dayKey].push(item);
  }

  const map: Record<string, MediaItem[]> = {};

  for (const [dayKey, list] of Object.entries(raw)) {
    const videos = list.filter((item) => item.type === "VIDEO");
    const photos = list.filter((item) => item.type === "PHOTO");
    const chosen = videos.length > 0 ? videos : photos;

    chosen.sort(
      (a, b) =>
        new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
    );

    if (chosen.length > 0) {
      map[dayKey] = chosen;
    }
  }

  return map;
}
