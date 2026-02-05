"use client";

import { useEffect, useState } from "react";

/* =======================
   Types
======================= */

type PhotoMetadata = {
  apertureFNumber?: number;
  exposureTime?: string;
  focalLength?: number;
  isoEquivalent?: number;
};

type VideoMetadata = {
  fps?: number;
  processingStatus?: "UNSPECIFIED" | "PROCESSING" | "READY" | "FAILED";
};

type MediaFileMetadata = {
  cameraMake?: string;
  cameraModel?: string;
  width: number;
  height: number;
  photoMetadata?: PhotoMetadata;
  videoMetadata?: VideoMetadata;
};

type MediaFile = {
  baseUrl: string;
  filename: string;
  mimeType: string;
  mediaFileMetadata: MediaFileMetadata;
};

type MediaItem = {
  id: string;
  createTime: string;
  type: "PHOTO" | "VIDEO";
  mediaFile: MediaFile;
};

/* =======================
   Helpers
======================= */

function groupVideosByDay(videos: MediaItem[]) {
  const map: Record<string, MediaItem[]> = {};

  for (const video of videos) {
    const dayKey = new Date(video.createTime)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    if (!map[dayKey]) map[dayKey] = [];
    map[dayKey].push(video);
  }

  Object.values(map).forEach((list) =>
    list.sort(
      (a, b) =>
        new Date(a.createTime).getTime() -
        new Date(b.createTime).getTime()
    )
  );

  return map;
}

/* =======================
   Video Player
======================= */

function VideoPlayer({
  video,
  accessToken,
}: {
  video: MediaItem;
  accessToken: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let currentUrl: string | null = null;

    async function fetchVideo() {
      const proxyUrl = `/api/photos/proxy?url=${encodeURIComponent(
        video.mediaFile.baseUrl + "=dv"
      )}`;

      const res = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) return;

      const blob = await res.blob();
      if (revoked) return;

      currentUrl = URL.createObjectURL(blob);
      setBlobUrl(currentUrl);
    }

    fetchVideo();

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [video.id, accessToken]);

  if (!blobUrl) {
    return <p style={{ fontSize: 12 }}>Loading video…</p>;
  }

  return (
    <video
      src={blobUrl}
      controls
      style={{ width: "100%", borderRadius: 6 }}
    />
  );
}

/* =======================
   Day Card (Accordion)
======================= */

function DayCard({
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

/* =======================
   Home Page
======================= */

export default function Home() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [videos, setVideos] = useState<MediaItem[]>([]);

  /* -----------------------
     OAuth listener
  ----------------------- */
  useEffect(() => {
    const stored = sessionStorage.getItem("google_access_token");
    if (stored) setAccessToken(stored);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
        setAccessToken(event.data.accessToken);
        sessionStorage.setItem(
          "google_access_token",
          event.data.accessToken
        );
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  /* -----------------------
     Picker
  ----------------------- */
  async function openPicker() {
    if (!accessToken) return;

    const res = await fetch("/api/photos/picker/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const { pickerUri, id } = await res.json();
    setSessionId(id);

    window.open(pickerUri, "photos-picker", "width=600,height=700");
  }

  /* -----------------------
     Poll picker session
  ----------------------- */
  useEffect(() => {
    if (!sessionId || !accessToken) return;

    const interval = setInterval(async () => {
      const res = await fetch(
        `/api/photos/picker/session/${sessionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      if (data.mediaItemsSet) {
        clearInterval(interval);

        const mediaRes = await fetch(
          `/api/photos/picker/media-items/${sessionId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken }),
          }
        );

        const media = await mediaRes.json();

        const onlyVideos = media.mediaItems.filter(
          (item: MediaItem) => item.type === "VIDEO"
        );

        setVideos(onlyVideos);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, accessToken]);

  /* -----------------------
     Login
  ----------------------- */
  function loginWithGoogle() {
    window.open(
      "/api/oauth/login",
      "google-oauth",
      "width=500,height=600"
    );
  }

  const videosByDay = groupVideosByDay(videos);
  const days = Object.keys(videosByDay).sort();

  /* -----------------------
     UI
  ----------------------- */
  return (
    <main style={{ padding: 24 }}>
      <h1>1 Second a Day</h1>

      {!accessToken ? (
        <button onClick={loginWithGoogle}>
          Login with Google
        </button>
      ) : (
        <>
          <p>✅ Logged in</p>

          <button onClick={openPicker}>
            Select videos from Google Photos
          </button>

          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            {days.map((day) => (
              <DayCard
                key={day}
                date={day}
                videos={videosByDay[day]}
                accessToken={accessToken}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}