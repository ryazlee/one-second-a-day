"use client";

import { compileOneSecondVideo } from "@/src/lib/compileVideo";
import { fetchVideoBlob } from "@/src/lib/fetchVideoBlob";
import {
  prefersShareSheet,
  saveExportedVideo,
} from "@/src/lib/saveExportedVideo";
import {
  DaySelection,
  ExportOrientation,
  MediaItem,
} from "@/src/types/types";
import { useCallback, useEffect, useState } from "react";

export type ReadyExport = {
  blob: Blob;
  filename: string;
};

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [readyExport, setReadyExport] = useState<ReadyExport | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      // nothing to revoke — blob held in memory until dismissed
    };
  }, [readyExport]);

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
      setReadyExport(null);
      setProgress(0);
      setLabel("Downloading clips…");

      try {
        const jobs: {
          dayKey: string;
          item: MediaItem;
          startSeconds: number;
        }[] = [];

        for (const dayKey of days) {
          const selection = selections[dayKey];
          if (!selection?.included) continue;
          const dayItems = videosByDay[dayKey] ?? [];

          for (const clip of selection.clips) {
            const item = dayItems.find((media) => media.id === clip.mediaId);
            if (!item) continue;
            jobs.push({
              dayKey,
              item,
              startSeconds: item.type === "PHOTO" ? 0 : clip.startSeconds,
            });
          }
        }

        if (jobs.length === 0) {
          throw new Error("No clips selected to export");
        }

        const clips = [];

        for (let i = 0; i < jobs.length; i++) {
          const job = jobs[i];
          setProgress((i + 0.2) / (jobs.length + 1));
          setLabel(`Downloading ${i + 1} of ${jobs.length}…`);
          const blob = await fetchVideoBlob(job.item, accessToken);
          clips.push({
            dayKey: job.dayKey,
            blob,
            startSeconds: job.startSeconds,
            kind:
              job.item.type === "PHOTO"
                ? ("photo" as const)
                : ("video" as const),
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

        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `one-second-a-day-${orientation}-${stamp}.${extension}`;
        const ready = { blob, filename };

        // Desktop: download immediately (works without a second tap).
        // Mobile: keep the file and wait for an explicit tap — iOS only allows
        // the share sheet from a direct user gesture.
        if (!prefersShareSheet()) {
          setLabel("Downloading…");
          await saveExportedVideo(blob, filename, { preferShare: false });
          setLabel("Downloaded");
          setReadyExport(ready);
        } else {
          setReadyExport(ready);
          setLabel("Ready — tap Save to Photos");
        }
        setProgress(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const saveReadyExport = useCallback(async () => {
    if (!readyExport || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveExportedVideo(
        readyExport.blob,
        readyExport.filename,
        { preferShare: true }
      );
      if (result === "shared") {
        setLabel("Pick Save Video to add it to Camera Roll");
      } else if (result === "downloaded") {
        setLabel("Downloaded");
      } else {
        setLabel("Save cancelled — tap Save to Photos to try again");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save video");
    } finally {
      setIsSaving(false);
    }
  }, [readyExport, isSaving]);

  const clearReadyExport = useCallback(() => {
    setReadyExport(null);
    setLabel("");
  }, []);

  return {
    isExporting,
    isSaving,
    progress,
    label,
    error,
    readyExport,
    exportVideo,
    saveReadyExport,
    clearReadyExport,
  };
}
