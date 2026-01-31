"use client";

import { useEffect, useState } from "react";

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

function VideoPlayer({ video, accessToken }: { video: MediaItem; accessToken: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;

    async function fetchVideo() {
      const proxyUrl = `/api/photos/proxy?url=${encodeURIComponent(video.mediaFile.baseUrl + "=dv")}`;
      const res = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok && !revoked) {
        const blob = await res.blob();
        setBlobUrl(URL.createObjectURL(blob));
      }
    }

    fetchVideo();

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [video, accessToken]);

  if (!blobUrl) return <p>Loading video...</p>;

  return <video src={blobUrl} controls width={300} />;
}

export default function Home() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [videos, setVideos] = useState<MediaItem[]>([]);

  // ---------------------------
  // OAuth popup listener
  // ---------------------------
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

  // ---------------------------
  // Open Google Photos Picker
  // ---------------------------
  async function openPicker() {
    if (!accessToken) return;

    const res = await fetch("/api/photos/picker/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const { pickerUri, id } = await res.json();

    window.open(pickerUri, "photos-picker", "width=600,height=700");
    setSessionId(id);
  }

  // ---------------------------
  // Poll picker session (POST!)
  // ---------------------------
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

        console.log("Media items:", media);

        const onlyVideos = media.mediaItems.filter(
          (item: MediaItem) => item.type === "VIDEO"
        );

        setVideos(onlyVideos);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, accessToken]);

  // ---------------------------
  // Login
  // ---------------------------
  function loginWithGoogle() {
    window.open(
      "/api/oauth/login",
      "google-oauth",
      "width=500,height=600"
    );
  }

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <main style={{ padding: 24 }}>
      <h1>1 Second a Day</h1>

      {!accessToken ? (
        <button onClick={loginWithGoogle}>Login with Google</button>
      ) : (
        <>
          <p>✅ Logged in</p>

          <button onClick={openPicker}>
            Select videos from Google Photos
          </button>

          <div style={{ marginTop: 24 }}>
            {videos.map((video) => (
              <VideoPlayer key={video.id} video={video} accessToken={accessToken} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
