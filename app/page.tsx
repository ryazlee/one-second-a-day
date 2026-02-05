"use client";

import { DayCard } from "@/src/components/DayCard";
import { usePhotosPicker } from "@/src/hooks/usePhotosPicker";
import { useVideos } from "@/src/hooks/useVideos";
import { MediaItem } from "@/src/types/types";
import { useEffect, useState } from "react";

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


export default function Home() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const { sessionId, isReady, isPolling, openPicker } = usePhotosPicker(accessToken);

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
     Login
  ----------------------- */
  function loginWithGoogle() {
    window.open(
      "/api/oauth/login",
      "google-oauth",
      "width=500,height=600"
    );
  }

  const {
    data: videos = [],
    isLoading: videosLoading,
  } = useVideos(isReady ? accessToken : null, isReady ? sessionId : null);

  const videosByDay = groupVideosByDay(videos);
  const days = Object.keys(videosByDay).sort();

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

          <button onClick={openPicker} disabled={isPolling}>
            {isPolling ? "Waiting for selection..." : "Select videos from Google Photos"}
          </button>

          {videosLoading && <p>Loading videos...</p>}

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