/** Save an exported video so mobile users can put it in the camera roll. */
export type SaveResult = "shared" | "downloaded" | "cancelled";

function canShareFiles(file: File): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

/**
 * Prefer the system share sheet on mobile (iOS offers “Save Video” → Photos).
 * Fall back to an anchor download on desktop / when share isn’t available.
 */
export async function saveExportedVideo(
  blob: Blob,
  filename: string
): Promise<SaveResult> {
  const type = blob.type || "video/mp4";
  const file = new File([blob], filename, { type });

  if (canShareFiles(file)) {
    try {
      await navigator.share({
        files: [file],
        title: "One Second a Day",
      });
      return "shared";
    } catch (err) {
      // User dismissed the sheet — don’t force a second download.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
      // Fall through to download.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Delay revoke so Safari can start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  }

  return "downloaded";
}
