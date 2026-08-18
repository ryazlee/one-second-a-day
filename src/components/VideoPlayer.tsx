"use client";

import {
  fetchPreviewObjectUrl,
  fetchVideoBlob,
} from "@/src/lib/fetchVideoBlob";
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const itemRef = useRef(video);
  itemRef.current = video;
  const isPhoto = video.type === "PHOTO";

  const [visible, setVisible] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setPreviewUrl(null);

    async function loadPreview() {
      try {
        const url = await fetchPreviewObjectUrl(itemRef.current, accessToken);
        if (!cancelled) setPreviewUrl(url);
      } catch {
        // Full media fetch is the source of truth.
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [visible, video.id, accessToken]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      setError(null);
      setBlobUrl(null);
      try {
        const blob = await fetchVideoBlob(itemRef.current, accessToken);
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : isPhoto
                ? "Couldn’t load this photo."
                : "Couldn’t load this video."
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [visible, video.id, accessToken, isPhoto, retryTick]);

  useEffect(() => {
    if (isPhoto) {
      onDuration?.(1);
      return;
    }

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
    // Intentionally omit onDuration — parent may pass an unstable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSeconds, blobUrl, isPhoto]);

  const frameClass = `video-frame ${
    orientation === "landscape" ? "video-frame--landscape" : ""
  }`;

  return (
    <div ref={rootRef} className={frameClass}>
      {isPhoto && (blobUrl || previewUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={blobUrl || previewUrl || ""} alt="" className="video-frame__photo" />
      ) : null}

      {!isPhoto && blobUrl ? (
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
      ) : null}

      {!isPhoto && !blobUrl && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="video-frame__photo" />
      ) : null}

      {!blobUrl && !error && visible ? (
        <div className={previewUrl ? "video-loading video-loading--overlay" : "video-loading"}>
          {isPhoto ? "Loading photo…" : "Loading video…"}
        </div>
      ) : null}

      {error && !blobUrl && visible ? (
        <div className="video-error">
          <p>{error}</p>
          <button
            type="button"
            className="video-error__retry"
            onClick={() => setRetryTick((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {showDateStamp ? (
        <div className="video-frame__stamp">{formatStamp(dayKey)}</div>
      ) : null}
    </div>
  );
}
