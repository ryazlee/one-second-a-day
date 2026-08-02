import { useCallback, useEffect, useState } from "react";
import {
  createPickerSession,
  getPickerSession,
} from "@/src/lib/googleClient";

const PENDING_PICKER_KEY = "osad-pending-picker";

type PendingPicker = {
  sessionId: string;
  accessToken: string;
  startedAt: number;
};

interface PickerSession {
  sessionId: string | null;
  isReady: boolean;
  isPolling: boolean;
  openPicker: () => Promise<void>;
  cancelPolling: () => void;
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
}

function readPending(): PendingPicker | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PICKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPicker;
    if (!parsed?.sessionId || !parsed?.accessToken) return null;
    // Ignore sessions older than 2 hours.
    if (Date.now() - parsed.startedAt > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_PICKER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePending(pending: PendingPicker) {
  sessionStorage.setItem(PENDING_PICKER_KEY, JSON.stringify(pending));
}

function clearPending() {
  sessionStorage.removeItem(PENDING_PICKER_KEY);
}

function withAutoclose(pickerUri: string): string {
  const trimmed = pickerUri.replace(/\/$/, "");
  return trimmed.endsWith("/autoclose") ? trimmed : `${trimmed}/autoclose`;
}

export function usePhotosPicker(accessToken: string | null): PickerSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollToken, setPollToken] = useState<string | null>(null);

  const beginPolling = useCallback((id: string, token: string) => {
    setSessionId(id);
    setPollToken(token);
    setIsReady(false);
    setIsPolling(true);
    writePending({
      sessionId: id,
      accessToken: token,
      startedAt: Date.now(),
    });
  }, []);

  const cancelPolling = useCallback(() => {
    clearPending();
    setIsPolling(false);
    setIsReady(false);
  }, []);

  // Resume a picker session after mobile returns to this tab/page.
  useEffect(() => {
    if (!accessToken) return;

    const pending = readPending();
    if (!pending) return;
    if (pending.accessToken !== accessToken) return;

    beginPolling(pending.sessionId, pending.accessToken);
  }, [accessToken, beginPolling]);

  const openPicker = useCallback(async () => {
    if (!accessToken) return;

    const { pickerUri, id } = await createPickerSession(accessToken);
    beginPolling(id, accessToken);

    if (isMobileViewport()) {
      // Mobile browsers throttle/kill desktop-style popups. Prefer a new tab
      // with /autoclose; if blocked, same-tab navigate without autoclose so the
      // user can return with the browser Back button.
      const opened = window.open(
        withAutoclose(pickerUri),
        "_blank",
        "noopener,noreferrer"
      );
      if (!opened) {
        window.location.assign(pickerUri);
      }
      return;
    }

    const popup = window.open(
      withAutoclose(pickerUri),
      "photos-picker",
      "width=600,height=700"
    );
    if (!popup) {
      window.location.assign(pickerUri);
    }
  }, [accessToken, beginPolling]);

  useEffect(() => {
    if (!sessionId || !pollToken || !isPolling) return;

    let cancelled = false;

    async function checkOnce() {
      try {
        const data = await getPickerSession(pollToken!, sessionId!);
        if (cancelled) return;
        if (data.mediaItemsSet) {
          clearPending();
          setIsPolling(false);
          setIsReady(true);
        }
      } catch {
        // keep polling
      }
    }

    // Immediate check — important when returning from Google Photos on mobile.
    void checkOnce();
    const interval = setInterval(() => {
      void checkOnce();
    }, 1500);

    function onVisible() {
      if (document.visibilityState === "visible") {
        void checkOnce();
      }
    }

    function onPageShow() {
      void checkOnce();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVisible);
    };
  }, [sessionId, pollToken, isPolling]);

  return {
    sessionId,
    isReady,
    isPolling,
    openPicker,
    cancelPolling,
  };
}
