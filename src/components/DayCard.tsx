"use client";

import { Button } from "@/src/components/Button";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { formatDayLabel, formatSeconds } from "@/src/lib/dates";
import {
  ClipSelection,
  DaySelection,
  ExportOrientation,
  MediaItem,
} from "@/src/types/types";
import { useMemo, useState } from "react";

export function DayCard({
  date,
  items,
  accessToken,
  selection,
  showDateStamp,
  orientation,
  onePerDay,
  onChange,
}: {
  date: string;
  items: MediaItem[];
  accessToken: string;
  selection: DaySelection;
  showDateStamp: boolean;
  orientation: ExportOrientation;
  onePerDay: boolean;
  onChange: (next: DaySelection) => void;
}) {
  const [openAlts, setOpenAlts] = useState(false);
  const [duration, setDuration] = useState(1);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => new Set(selection.clips.map((clip) => clip.mediaId)),
    [selection.clips]
  );

  const activeId =
    previewId && selectedIds.has(previewId)
      ? previewId
      : selection.clips[0]?.mediaId ?? items[0]?.id;

  const selected = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0],
    [items, activeId]
  );

  const activeClip: ClipSelection = useMemo(() => {
    const existing = selection.clips.find((clip) => clip.mediaId === selected?.id);
    return existing ?? { mediaId: selected?.id ?? "", startSeconds: 0 };
  }, [selection.clips, selected?.id]);

  const isPhoto = selected?.type === "PHOTO";
  const maxStart = Math.max(0, (Number.isFinite(duration) ? duration : 1) - 1);
  const photoOnlyDay = items.length > 0 && items.every((item) => item.type === "PHOTO");

  function handleDuration(next: number) {
    setDuration((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
  }

  function setClips(clips: ClipSelection[]) {
    onChange({ ...selection, clips });
  }

  function selectSingle(mediaId: string) {
    setPreviewId(mediaId);
    setClips([{ mediaId, startSeconds: 0 }]);
  }

  function toggleMulti(mediaId: string) {
    const exists = selection.clips.some((clip) => clip.mediaId === mediaId);
    if (exists) {
      // First tap focuses trim/preview; second tap removes (when more than one).
      if (activeId !== mediaId) {
        setPreviewId(mediaId);
        return;
      }
      if (selection.clips.length <= 1) return;
      const next = selection.clips.filter((clip) => clip.mediaId !== mediaId);
      setPreviewId(next[0]?.mediaId ?? null);
      setClips(next);
      return;
    }

    const ordered = items
      .filter((item) => selectedIds.has(item.id) || item.id === mediaId)
      .map((item) => {
        const existing = selection.clips.find((clip) => clip.mediaId === item.id);
        return existing ?? { mediaId: item.id, startSeconds: 0 };
      });
    setPreviewId(mediaId);
    setClips(ordered);
  }

  function updateActiveStart(startSeconds: number) {
    setClips(
      selection.clips.map((clip) =>
        clip.mediaId === activeClip.mediaId ? { ...clip, startSeconds } : clip
      )
    );
  }

  if (!selected) return null;

  const clipLabel =
    selection.clips.length === 1
      ? "1 second"
      : `${selection.clips.length} seconds`;

  return (
    <article className="surface-card day-card">
      <div className="day-card__top">
        <div>
          <h3 className="day-card__date">{formatDayLabel(date)}</h3>
          <p className="day-card__meta">
            {items.length} {photoOnlyDay ? "photo" : "clip"}
            {items.length === 1 ? "" : "s"}
            {photoOnlyDay ? " · photo fallback" : ""} · {clipLabel}
          </p>
        </div>
        <label
          className="toggle"
          title={selection.included ? "Included" : "Skipped"}
        >
          <input
            type="checkbox"
            checked={selection.included}
            onChange={(e) =>
              onChange({ ...selection, included: e.target.checked })
            }
          />
          <span />
        </label>
      </div>

      <VideoPlayer
        video={selected}
        accessToken={accessToken}
        startSeconds={activeClip.startSeconds}
        showDateStamp={showDateStamp}
        dayKey={date}
        orientation={orientation}
        onDuration={handleDuration}
      />

      {!isPhoto ? (
        <div className="trim-controls">
          <label>
            <span>1s start</span>
            <span className="trim-readout">
              {formatSeconds(activeClip.startSeconds)} –{" "}
              {formatSeconds(activeClip.startSeconds + 1)}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={maxStart}
            step={0.1}
            value={Math.min(activeClip.startSeconds, maxStart)}
            disabled={!selection.included || maxStart <= 0}
            onChange={(e) => updateActiveStart(Number(e.target.value))}
          />
        </div>
      ) : (
        <p className="muted day-card__photo-note">
          Photos export as a 1-second still — no trim needed.
        </p>
      )}

      {items.length > 1 ? (
        <div>
          <Button
            label={
              openAlts
                ? "Hide other clips"
                : onePerDay
                  ? `Choose another (${items.length})`
                  : `Select clips (${selection.clips.length}/${items.length})`
            }
            variant="ghost"
            size="sm"
            onClick={() => setOpenAlts((v) => !v)}
          />
          {openAlts ? (
            <div className="chip-row" style={{ marginTop: 6 }}>
              {items.map((item) => {
                const active = selectedIds.has(item.id);
                const previewing = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip ${active ? "chip--active" : ""} ${
                      previewing ? "chip--preview" : ""
                    }`}
                    onClick={() => {
                      if (onePerDay) selectSingle(item.id);
                      else toggleMulti(item.id);
                    }}
                  >
                    {item.type === "PHOTO" ? "Photo · " : ""}
                    {new Date(item.createTime).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </button>
                );
              })}
            </div>
          ) : null}
          {!onePerDay && openAlts ? (
            <p className="muted" style={{ marginTop: 6 }}>
              Tap to add clips. Tap a selected clip to preview/trim; tap again to
              remove (keep at least one).
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
