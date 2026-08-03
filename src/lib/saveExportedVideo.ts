/** Save an exported video so mobile users can put it in the camera roll. */
export type SaveResult = "shared" | "downloaded" | "cancelled";

export function canShareVideoFile(file: File): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return false;
    }
    if (typeof navigator.canShare !== "function") {
      // Older share support without canShare — still try from a tap.
      return true;
    }
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function prefersShareSheet(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    window.matchMedia("(max-width: 768px)").matches
  );
}

/**
 * Must be called from a direct user tap on mobile — iOS blocks share after
 * long async work (same restriction as popups / AudioContext).
 */
export async function saveExportedVideo(
  blob: Blob,
  filename: string,
  options?: { preferShare?: boolean }
): Promise<SaveResult> {
  const type = blob.type.includes("video/") ? blob.type : "video/mp4";
  const file = new File([blob], filename, { type });
  const preferShare = options?.preferShare ?? prefersShareSheet();

  if (preferShare && typeof navigator.share === "function") {
    try {
      // Prefer canShare when available, but still attempt share on tap —
      // some iOS versions report canShare false for large files incorrectly.
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "One Second a Day",
        });
        return "shared";
      }
    } catch (err) {
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
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  }

  return "downloaded";
}
