"use client";

import { compileOneSecondVideo } from "@/src/lib/compileVideo";
import { fetchVideoBlob } from "@/src/lib/fetchVideoBlob";
import {
  DaySelection,
  ExportOrientation,
  MediaItem,
} from "@/src/types/types";
import { useCallback, useState } from "react";

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const exportVideo = useCallback(
    async ({
      days,
      selections,
      videosByDay,
      accessToken,
      showDateStamp,
      orientation,
    }: {
      days: string[];
      selections: Record<string, DaySelection>;
      videosByDay: Record<string, MediaItem[]>;
      accessToken: string;
      showDateStamp: boolean;
      orientation: ExportOrientation;
    }) => {
      setIsExporting(true);
      setError(null);
      setProgress(0);
      setLabel("Downloading clips…");

      try {
        const clips = [];

        for (let i = 0; i < days.length; i++) {
          const dayKey = days[i];
          const selection = selections[dayKey];
          const video = videosByDay[dayKey].find(
            (v) => v.id === selection.mediaId
          );
          if (!video) continue;

          setProgress((i + 0.2) / (days.length + 1));
          setLabel(`Downloading ${i + 1} of ${days.length}…`);
          const blob = await fetchVideoBlob(video, accessToken);
          clips.push({
            dayKey,
            blob,
            startSeconds: selection.startSeconds,
          });
        }

        const { blob, extension } = await compileOneSecondVideo({
          clips,
          showDateStamp,
          orientation,
          onProgress: (ratio, nextLabel) => {
            setProgress(0.5 + ratio * 0.5);
            setLabel(nextLabel);
          },
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `one-second-a-day-${orientation}-${stamp}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
        setLabel("Downloaded");
        setProgress(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return {
    isExporting,
    progress,
    label,
    error,
    exportVideo,
  };
}
