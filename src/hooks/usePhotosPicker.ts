import { useCallback, useEffect, useState } from "react";
import {
  createPickerSession,
  getPickerSession,
} from "@/src/lib/googleClient";

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

    const { pickerUri, id } = await createPickerSession(accessToken);
    setSessionId(id);
    setIsReady(false);
    setIsPolling(true);

    window.open(pickerUri, "photos-picker", "width=600,height=700");
  }, [accessToken]);

  useEffect(() => {
    if (!sessionId || !accessToken || !isPolling) return;

    const interval = setInterval(async () => {
      try {
        const data = await getPickerSession(accessToken, sessionId);
        if (data.mediaItemsSet) {
          clearInterval(interval);
          setIsPolling(false);
          setIsReady(true);
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [sessionId, accessToken, isPolling]);

  return {
    sessionId,
    isReady,
    isPolling,
    openPicker,
  };
}
