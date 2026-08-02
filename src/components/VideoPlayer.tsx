"use client";

import { fetchVideoBlob } from "@/src/lib/fetchVideoBlob";
import { formatStamp } from "@/src/lib/dates";
import { ExportOrientation, MediaItem } from "@/src/types/types";
import { useEffect, useRef, useState } from "react";

export function VideoPlayer({
  video,
  accessToken,
  startSeconds,
  showDateStamp,
  dayKey,
  orientation,
  onDuration,
}: {
  video: MediaItem;
  accessToken: string;
  startSeconds: number;
  showDateStamp: boolean;
  dayKey: string;
  orientation: ExportOrientation;
  onDuration?: (duration: number) => void;
}) {
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = useRef(video);
  videoRef.current = video;

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      setError(null);
      setBlobUrl(null);
      try {
        const blob = await fetchVideoBlob(videoRef.current, accessToken);
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch {
        if (!cancelled) setError("Couldn’t load this video.");
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [video.id, accessToken]);

  useEffect(() => {
    const el = videoElRef.current;
    if (!el || !blobUrl) return;

    const applyStart = () => {
      const maxStart = Math.max(0, (el.duration || 1) - 1);
      const next = Math.min(Math.max(0, startSeconds), maxStart);
      if (Math.abs(el.currentTime - next) > 0.05) {
        el.currentTime = next;
      }
    };

    if (el.readyState >= 1) applyStart();
    else el.addEventListener("loadedmetadata", applyStart, { once: true });

    return () => el.removeEventListener("loadedmetadata", applyStart);
  }, [startSeconds, blobUrl]);

  if (error) {
    return (
      <div className="video-frame">
        <div className="video-error">{error}</div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="video-frame">
        <div className="video-loading">Loading video…</div>
      </div>
    );
  }

  return (
    <div
      className={`video-frame ${
        orientation === "landscape" ? "video-frame--landscape" : ""
      }`}
    >
      <video
        ref={videoElRef}
        src={blobUrl}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const duration = e.currentTarget.duration;
          if (Number.isFinite(duration) && duration > 0) {
            onDuration?.(duration);
          }
        }}
      />
      {showDateStamp ? (
        <div className="video-frame__stamp">{formatStamp(dayKey)}</div>
      ) : null}
    </div>
  );
}
