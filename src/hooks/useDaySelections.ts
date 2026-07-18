"use client";

import { DaySelection, MediaItem } from "@/src/types/types";
import { useMemo, useState } from "react";

type DayOverride = Partial<
  Pick<DaySelection, "mediaId" | "startSeconds" | "included">
>;

export function useDaySelections(videosByDay: Record<string, MediaItem[]>) {
  const days = useMemo(
    () => Object.keys(videosByDay).sort(),
    [videosByDay]
  );

  const [overrides, setOverrides] = useState<Record<string, DayOverride>>({});

  const selections = useMemo(() => {
    const next: Record<string, DaySelection> = {};

    for (const day of days) {
      const videos = videosByDay[day];
      const override = overrides[day];
      const mediaStillValid =
        !!override?.mediaId &&
        videos.some((video) => video.id === override.mediaId);

      next[day] = {
        dayKey: day,
        mediaId: mediaStillValid ? override!.mediaId! : videos[0].id,
        startSeconds: override?.startSeconds ?? 0,
        included: override?.included ?? true,
      };
    }

    return next;
  }, [days, overrides, videosByDay]);

  function updateDay(dayKey: string, patch: Partial<DaySelection>) {
    setOverrides((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ...patch,
      },
    }));
  }

  const includedDays = days.filter((day) => selections[day]?.included);

  return {
    days,
    selections,
    includedDays,
    updateDay,
  };
}
