import { useState, useEffect, useCallback } from "react";

interface PickerSession {
  sessionId: string | null;
  isReady: boolean;
  isPolling: boolean;
  openPicker: () => Promise<void>;
}

export function usePhotosPicker(accessToken: string | null): PickerSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const openPicker = useCallback(async () => {
    if (!accessToken) return;

    const res = await fetch("/api/photos/picker/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const { pickerUri, id } = await res.json();
    setSessionId(id);
    setIsReady(false);

    window.open(pickerUri, "photos-picker", "width=600,height=700");
  }, [accessToken]);

  // Poll picker session until media items are set
  useEffect(() => {
    if (!sessionId || !accessToken) return;

    setIsPolling(true);

    const interval = setInterval(async () => {
      const res = await fetch(`/api/photos/picker/session/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      if (!res.ok) return;

      const data = await res.json();

      if (data.mediaItemsSet) {
        clearInterval(interval);
        setIsPolling(false);
        setIsReady(true);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [sessionId, accessToken]);

  return {
    sessionId,
    isReady,
    isPolling,
    openPicker,
  };
}
