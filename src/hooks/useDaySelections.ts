"use client";

import {
  ClipSelection,
  DaySelection,
  MediaItem,
} from "@/src/types/types";
import { useEffect, useMemo, useState } from "react";

type DayOverride = {
  included?: boolean;
  clips?: ClipSelection[];
};

function defaultClips(items: MediaItem[]): ClipSelection[] {
  if (items.length === 0) return [];
  return [{ mediaId: items[0].id, startSeconds: 0 }];
}

function sanitizeClips(
  items: MediaItem[],
  clips: ClipSelection[] | undefined,
  onePerDay: boolean
): ClipSelection[] {
  const ids = new Set(items.map((item) => item.id));
  const valid = (clips ?? [])
    .filter((clip) => ids.has(clip.mediaId))
    .map((clip) => ({
      mediaId: clip.mediaId,
      startSeconds: Math.max(0, clip.startSeconds || 0),
    }));

  if (valid.length === 0) return defaultClips(items);

  if (onePerDay) {
    return [valid[0]];
  }

  // Preserve order; drop duplicates.
  const seen = new Set<string>();
  const unique: ClipSelection[] = [];
  for (const clip of valid) {
    if (seen.has(clip.mediaId)) continue;
    seen.add(clip.mediaId);
    unique.push(clip);
  }
  return unique.length > 0 ? unique : defaultClips(items);
}

export function useDaySelections(
  mediaByDay: Record<string, MediaItem[]>,
  onePerDay: boolean
) {
  const days = useMemo(() => Object.keys(mediaByDay).sort(), [mediaByDay]);

  const [overrides, setOverrides] = useState<Record<string, DayOverride>>({});

  // When onePerDay turns on, collapse any multi-clip days to a single clip.
  useEffect(() => {
    if (!onePerDay) return;
    setOverrides((prev) => {
      let changed = false;
      const next: Record<string, DayOverride> = { ...prev };
      for (const [day, override] of Object.entries(prev)) {
        if (override.clips && override.clips.length > 1) {
          next[day] = { ...override, clips: [override.clips[0]] };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [onePerDay]);

  const selections = useMemo(() => {
    const next: Record<string, DaySelection> = {};

    for (const day of days) {
      const items = mediaByDay[day] ?? [];
      const override = overrides[day];
      next[day] = {
        dayKey: day,
        included: override?.included ?? true,
        clips: sanitizeClips(items, override?.clips, onePerDay),
      };
    }

    return next;
  }, [days, overrides, mediaByDay, onePerDay]);

  function updateDay(dayKey: string, patch: Partial<DaySelection>) {
    setOverrides((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ...patch,
        clips: patch.clips ?? prev[dayKey]?.clips,
      },
    }));
  }

  const includedDays = days.filter((day) => selections[day]?.included);

  const includedClipCount = includedDays.reduce(
    (sum, day) => sum + (selections[day]?.clips.length ?? 0),
    0
  );

  return {
    days,
    selections,
    includedDays,
    includedClipCount,
    updateDay,
  };
}
