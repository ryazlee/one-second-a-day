import { MediaItem } from "@/src/types/types";
import { useState, useEffect } from "react";

export function VideoPlayer({
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