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

  // Resume a picker session after returning to this tab/page (mobile Back).
  useEffect(() => {
    if (!accessToken) return;

    const pending = readPending();
    if (!pending) return;
    if (pending.accessToken !== accessToken) return;

    beginPolling(pending.sessionId, pending.accessToken);
  }, [accessToken, beginPolling]);

  const openPicker = useCallback(async () => {
    if (!accessToken) return;

    // Mobile: same-tab only. Google's picker can't run in an iframe, and
    // window.open after an async call often opens a blank/extra tab while also
    // leaving the app — which feels like "two pickers." Navigate away, pick,
    // then use Back; session is persisted so we resume polling on return.
    if (isMobileViewport()) {
      const { pickerUri, id } = await createPickerSession(accessToken);
      beginPolling(id, accessToken);
      // No /autoclose — that would close the only tab. User returns via Back.
      window.location.assign(pickerUri);
      return;
    }

    // Desktop: open the popup synchronously in the click handler so blockers
    // don't leave a blank window + force a second navigation. Then point it at
    // the picker URI once the session exists (Google's recommended web flow).
    const popup = window.open("about:blank", "photos-picker", "width=600,height=700");

    try {
      const { pickerUri, id } = await createPickerSession(accessToken);
      beginPolling(id, accessToken);
      const url = withAutoclose(pickerUri);

      if (popup && !popup.closed) {
        popup.location.href = url;
        popup.focus();
        return;
      }

      // Popup blocked — stay in-app and open Photos in this tab as a last resort.
      window.location.assign(pickerUri);
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      throw error;
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
