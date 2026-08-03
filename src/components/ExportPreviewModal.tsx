"use client";

import { Button } from "@/src/components/Button";
import { prefersShareSheet } from "@/src/lib/saveExportedVideo";
import { useEffect, useId, useRef } from "react";

export type ExportPreview = {
  blob: Blob;
  filename: string;
  url: string;
};

export function ExportPreviewModal({
  exportFile,
  isSaving,
  status,
  onShare,
  onDownload,
  onClose,
}: {
  exportFile: ExportPreview;
  isSaving: boolean;
  status?: string | null;
  onShare: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const showShare = prefersShareSheet();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="export-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="export-modal__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="export-modal__header">
          <h2 id={titleId}>Your video</h2>
          <button
            ref={closeRef}
            type="button"
            className="export-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="export-modal__player">
          <video
            src={exportFile.url}
            controls
            playsInline
            autoPlay
            muted
            loop
          />
        </div>

        {status ? <p className="export-modal__status muted">{status}</p> : null}

        <div className="export-modal__actions">
          {showShare ? (
            <Button
              label={isSaving ? "Opening…" : "Save to Photos"}
              onClick={onShare}
              disabled={isSaving}
            />
          ) : null}
          <Button
            label={isSaving ? "Saving…" : "Download"}
            variant={showShare ? "secondary" : "primary"}
            onClick={onDownload}
            disabled={isSaving}
          />
          <Button
            label="Close"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
          />
        </div>

        {showShare ? (
          <p className="export-modal__hint muted">
            Save to Photos opens the share sheet — choose{" "}
            <strong>Save Video</strong> for Camera Roll.
          </p>
        ) : null}
      </div>
    </div>
  );
}
