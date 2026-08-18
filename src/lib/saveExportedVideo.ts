/** Save an exported video so mobile users can put it in the camera roll. */

export type SaveResult = "shared" | "downloaded" | "cancelled";

export type PreparedExport = {
  blob: Blob;
  file: File;
  filename: string;
};

function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function canShareVideoFile(file: File): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return false;
    }
    if (typeof navigator.canShare !== "function") {
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

/** Copy bytes into a real File so iOS share isn’t handed a lazy MediaRecorder blob. */
export async function prepareExportFile(
  blob: Blob,
  filename: string
): Promise<PreparedExport> {
  const looksMp4 =
    filename.toLowerCase().endsWith(".mp4") ||
    blob.type.toLowerCase().includes("mp4") ||
    blob.type.toLowerCase().includes("quicktime");
  const type = looksMp4
    ? "video/mp4"
    : blob.type.includes("video/")
      ? blob.type
      : "video/webm";
  const safeName = filename.replace(/\.(webm|mp4|mov)$/i, "") + (looksMp4 ? ".mp4" : ".webm");

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(new Uint8Array(buffer));

  const materialized = new Blob([bytes], { type });
  const file = new File([bytes], safeName, { type, lastModified: Date.now() });
  return { blob: materialized, file, filename: safeName };
}

async function saveWithFilePicker(file: File): Promise<SaveResult | null> {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: {
          description: string;
          accept: Record<string, string[]>;
        }[];
      }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;

  if (typeof picker !== "function") return null;

  try {
    const accept: Record<string, string[]> = file.type.includes("mp4")
      ? { "video/mp4": [".mp4"] }
      : { "video/webm": [".webm"], "video/mp4": [".mp4"] };
    const handle = await picker({
      suggestedName: file.name,
      types: [{ description: "Video", accept }],
    });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return "downloaded";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return null;
  }
}

function triggerAnchorDownload(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // iOS may still be reading the blob after click — don’t revoke immediately.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Must be called from a direct user tap on mobile — iOS blocks share after
 * long async work (same restriction as popups / AudioContext).
 *
 * Pass a File prepared ahead of time so share() runs inside the tap.
 */
export async function saveExportedVideo(
  file: File,
  options?: { preferShare?: boolean }
): Promise<SaveResult> {
  const preferShare = options?.preferShare ?? prefersShareSheet();

  if (preferShare && typeof navigator.share === "function") {
    try {
      // Files only — title/text/url hide “Save Video” on some iOS versions.
      const data = { files: [file] };
      if (!navigator.canShare || navigator.canShare(data)) {
        await navigator.share(data);
        return "shared";
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
      // Fall through to download.
    }
  }

  if (!isAppleTouchDevice()) {
    const picked = await saveWithFilePicker(file);
    if (picked) return picked;
  }

  triggerAnchorDownload(file);
  return "downloaded";
}
