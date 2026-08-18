"use client";

import { compileOneSecondVideo } from "@/src/lib/compileVideo";
import { ensureFreshToken } from "@/src/lib/authToken";
import { fetchVideoBlob } from "@/src/lib/fetchVideoBlob";
import {
  PreparedExport,
  prepareExportFile,
  saveExportedVideo,
} from "@/src/lib/saveExportedVideo";
import {
  DaySelection,
  ExportOrientation,
  MediaItem,
} from "@/src/types/types";
import { useCallback, useState } from "react";

export type ReadyExport = PreparedExport & {
  url: string;
};

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [readyExport, setReadyExport] = useState<ReadyExport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const clearReadyExport = useCallback(() => {
    setReadyExport((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setSaveStatus(null);
    setLabel("");
  }, []);

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
      setSaveStatus(null);
      setReadyExport((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return null;
      });
      setProgress(0);
      setLabel("Downloading clips…");

      try {
        const token = (await ensureFreshToken()) || accessToken;

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
          const blob = await fetchVideoBlob(job.item, token);
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
        setLabel("Preparing save…");
        const prepared = await prepareExportFile(blob, filename);
        const url = URL.createObjectURL(prepared.blob);

        setReadyExport({ ...prepared, url });
        setLabel("Preview ready");
        setProgress(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const shareReadyExport = useCallback(async () => {
    if (!readyExport || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveExportedVideo(readyExport.file, {
        preferShare: true,
      });
      if (result === "shared") {
        setSaveStatus("Choose Save Video in the share sheet for Camera Roll");
      } else if (result === "downloaded") {
        setSaveStatus(
          readyExport.filename.endsWith(".mp4")
            ? "Saved — check Photos or Downloads"
            : "Downloaded"
        );
      } else {
        setSaveStatus("Cancelled — try again when you’re ready");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save video");
    } finally {
      setIsSaving(false);
    }
  }, [readyExport, isSaving]);

  const downloadReadyExport = useCallback(async () => {
    if (!readyExport || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveExportedVideo(readyExport.file, {
        preferShare: false,
      });
      if (result === "cancelled") {
        setSaveStatus("Cancelled — try again when you’re ready");
      } else {
        setSaveStatus(
          readyExport.filename.endsWith(".mp4")
            ? "Saved — check Photos or Downloads"
            : "Downloaded"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t download video");
    } finally {
      setIsSaving(false);
    }
  }, [readyExport, isSaving]);

  return {
    isExporting,
    isSaving,
    progress,
    label,
    error,
    readyExport,
    saveStatus,
    exportVideo,
    shareReadyExport,
    downloadReadyExport,
    clearReadyExport,
  };
}
