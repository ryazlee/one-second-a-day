import { VideoPlayer } from "@/src/components/VideoPlayer";
import { MediaItem } from "@/src/types/types";
import { useState } from "react";

export function DayCard({
  date,
  videos,
  accessToken,
}: {
  date: string;
  videos: MediaItem[];
  accessToken: string;
}) {
  const [selected, setSelected] = useState<MediaItem>(videos[0]);
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        background: "#fff",
      }}
    >
      <h3 style={{ marginBottom: 8 }}>
        {new Date(date).toDateString()}
      </h3>

      <VideoPlayer video={selected} accessToken={accessToken} />

      {videos.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setOpen(!open)}
            style={{ fontSize: 12 }}
          >
            {open
              ? "Hide other videos"
              : `Choose another (${videos.length})`}
          </button>

          {open && (
            <div style={{ marginTop: 6 }}>
              {videos.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: 12,
                    fontWeight:
                      v.id === selected.id ? "bold" : "normal",
                  }}
                >
                  {new Date(v.createTime).toLocaleTimeString()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}