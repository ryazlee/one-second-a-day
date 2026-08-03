import { useCallback, useEffect, useRef, useState } from "react";
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
  /** True when Photos opened in another tab (autoclose can return the user). */
  openedInNewTab: boolean;
  openPicker: () => Promise<void>;
  cancelPolling: () => void;
}

function readPending(): PendingPicker | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PICKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPicker;
    if (!parsed?.sessionId || !parsed?.accessToken) return null;
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

/** True if we got a real separate browsing context (not this tab). */
function isSeparateWindow(popup: Window | null): boolean {
  return Boolean(popup && !popup.closed && popup !== window);
}

export function usePhotosPicker(accessToken: string | null): PickerSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollToken, setPollToken] = useState<string | null>(null);
  const [openedInNewTab, setOpenedInNewTab] = useState(false);
  const readySessionRef = useRef<string | null>(null);

  const markReady = useCallback((id: string) => {
    clearPending();
    readySessionRef.current = id;
    setSessionId(id);
    setIsPolling(false);
    setIsReady(true);
    setOpenedInNewTab(false);
  }, []);

  const beginPolling = useCallback((id: string, token: string) => {
    if (readySessionRef.current === id) {
      clearPending();
      setSessionId(id);
      setIsReady(true);
      setIsPolling(false);
      return;
    }

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
    setOpenedInNewTab(false);
  }, []);

  // Resume after returning via Back (same-tab fallback) or tab switch.
  useEffect(() => {
    if (!accessToken) return;

    const pending = readPending();
    if (!pending) return;
    if (pending.accessToken !== accessToken) return;

    beginPolling(pending.sessionId, pending.accessToken);
  }, [accessToken, beginPolling]);

  const openPicker = useCallback(async () => {
    if (!accessToken) return;

    readySessionRef.current = null;

    // Open synchronously in the click gesture so mobile browsers allow a new
    // tab. With /autoclose, that tab closes when picking finishes and the user
    // lands back on this app tab (still polling).
    const popup = window.open("about:blank", "photos-picker");

    try {
      const { pickerUri, id } = await createPickerSession(accessToken);
      beginPolling(id, accessToken);

      if (isSeparateWindow(popup) && popup) {
        setOpenedInNewTab(true);
        popup.location.href = withAutoclose(pickerUri);
        popup.focus();
        return;
      }

      // Popup blocked / same-tab hijack: navigate this tab. No /autoclose
      // (that would close the only tab). User returns with Back.
      setOpenedInNewTab(false);
      if (popup && popup !== window && !popup.closed) {
        try {
          popup.close();
        } catch {
          // ignore
        }
      }
      window.location.assign(pickerUri);
    } catch (error) {
      setOpenedInNewTab(false);
      if (isSeparateWindow(popup) && popup) popup.close();
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
          markReady(sessionId!);
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
  }, [sessionId, pollToken, isPolling, markReady]);

  return {
    sessionId,
    isReady,
    isPolling,
    openedInNewTab,
    openPicker,
    cancelPolling,
  };
}
