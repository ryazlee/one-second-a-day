"use client";

import { Button } from "@/src/components/Button";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { formatDayLabel, formatSeconds } from "@/src/lib/dates";
import {
  DaySelection,
  ExportOrientation,
  MediaItem,
} from "@/src/types/types";
import { useMemo, useState } from "react";

export function DayCard({
  date,
  videos,
  accessToken,
  selection,
  showDateStamp,
  orientation,
  onChange,
}: {
  date: string;
  videos: MediaItem[];
  accessToken: string;
  selection: DaySelection;
  showDateStamp: boolean;
  orientation: ExportOrientation;
  onChange: (next: DaySelection) => void;
}) {
  const [openAlts, setOpenAlts] = useState(false);
  const [duration, setDuration] = useState(1);

  const selected = useMemo(
    () => videos.find((v) => v.id === selection.mediaId) ?? videos[0],
    [videos, selection.mediaId]
  );

  const maxStart = Math.max(0, duration - 1);

  return (
    <article className="surface-card day-card">
      <div className="day-card__top">
        <div>
          <h3 className="day-card__date">{formatDayLabel(date)}</h3>
          <p className="day-card__meta">
            {videos.length} clip{videos.length === 1 ? "" : "s"} · 1 second
          </p>
        </div>
        <label className="toggle" title={selection.included ? "Included" : "Skipped"}>
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
        startSeconds={selection.startSeconds}
        showDateStamp={showDateStamp}
        dayKey={date}
        orientation={orientation}
        onDuration={setDuration}
      />

      <div className="trim-controls">
        <label>
          <span>1s start</span>
          <span className="trim-readout">
            {formatSeconds(selection.startSeconds)} –{" "}
            {formatSeconds(selection.startSeconds + 1)}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={maxStart}
          step={0.1}
          value={Math.min(selection.startSeconds, maxStart)}
          disabled={!selection.included || maxStart <= 0}
          onChange={(e) =>
            onChange({
              ...selection,
              startSeconds: Number(e.target.value),
            })
          }
        />
      </div>

      {videos.length > 1 ? (
        <div>
          <Button
            label={
              openAlts
                ? "Hide other clips"
                : `Choose another (${videos.length})`
            }
            variant="ghost"
            size="sm"
            onClick={() => setOpenAlts((v) => !v)}
          />
          {openAlts ? (
            <div className="chip-row" style={{ marginTop: 6 }}>
              {videos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`chip ${
                    v.id === selected.id ? "chip--active" : ""
                  }`}
                  onClick={() =>
                    onChange({
                      ...selection,
                      mediaId: v.id,
                      startSeconds: 0,
                    })
                  }
                >
                  {new Date(v.createTime).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
