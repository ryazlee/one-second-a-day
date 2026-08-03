import { formatStamp } from "@/src/lib/dates";
import { ExportOrientation } from "@/src/types/types";

export type CompileClip = {
  dayKey: string;
  blob: Blob;
  startSeconds: number;
  kind: "video" | "photo";
};

export type CompileOptions = {
  clips: CompileClip[];
  showDateStamp: boolean;
  orientation: ExportOrientation;
  onProgress?: (ratio: number, label: string) => void;
};

const CLIP_DURATION = 1;
const OUTPUT_FPS = 30;
const PORTRAIT_SIZE = { width: 1080, height: 1920 };
const LANDSCAPE_SIZE = { width: 1920, height: 1080 };
export const SITE_CREDIT_URL = "ryazlee.github.io/one-second-a-day";
export const SITE_CREDIT_LINE = "Made with";

export function outputSizeForOrientation(orientation: ExportOrientation) {
  return orientation === "landscape" ? LANDSCAPE_SIZE : PORTRAIT_SIZE;
}

function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";

  // Safari / iOS: MP4 (H.264). Chrome: WebM. Prefer what the engine actually supports.
  const candidates = isAppleTouchDevice()
    ? ["video/mp4", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm"]
    : [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

async function resumeAudioContext(audioCtx: AudioContext): Promise<boolean> {
  if ((audioCtx.state as string) === "running") return true;
  try {
    await Promise.race([
      audioCtx.resume(),
      wait(400).then(() => {
        throw new Error("AudioContext resume timed out");
      }),
    ]);
  } catch {
    return false;
  }
  return (audioCtx.state as string) === "running";
}

function loadVideo(blob: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.crossOrigin = "anonymous";
    // iOS often won't decode detached videos — keep a 1×1 node in the DOM.
    video.setAttribute(
      "style",
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1"
    );
    document.body.appendChild(video);

    const url = URL.createObjectURL(blob);
    video.src = url;

    let settled = false;
    const cleanupListeners = () => {
      window.clearTimeout(timeout);
      video.onloadeddata = null;
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onerror = null;
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      resolve(video);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      try {
        video.remove();
      } catch {
        // ignore
      }
      URL.revokeObjectURL(url);
      reject(new Error(message));
    };

    const timeout = window.setTimeout(
      () => fail("Timed out loading video for export"),
      isAppleTouchDevice() ? 8_000 : 20_000
    );

    const maybeReady = () => {
      if (video.readyState >= 2 || video.videoWidth > 0) succeed();
    };

    video.onloadedmetadata = maybeReady;
    video.onloadeddata = maybeReady;
    video.oncanplay = maybeReady;
    video.onerror = () => fail("Failed to load video for export");

    try {
      video.load();
    } catch {
      // ignore
    }

    // Nudge the decoder — required on some iOS versions for blob URLs.
    void video
      .play()
      .then(() => {
        video.pause();
        maybeReady();
      })
      .catch(() => maybeReady());
  });
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;

  const target = Math.min(
    Math.max(0, time),
    Math.max(0, video.duration - 0.05)
  );

  if (Math.abs(video.currentTime - target) < 0.04) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", finish);
      video.removeEventListener("error", finish);
      resolve();
    };

    // iOS often never fires seeked for blob URLs — never block the export.
    const timeout = window.setTimeout(finish, 1500);
    video.addEventListener("seeked", finish);
    video.addEventListener("error", finish);
    try {
      video.currentTime = target;
    } catch {
      finish();
    }
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playWithTimeout(
  video: HTMLVideoElement,
  ms: number
): Promise<boolean> {
  try {
    await Promise.race([
      video.play().then(() => true),
      wait(ms).then(() => false),
    ]);
    return !video.paused;
  } catch {
    return false;
  }
}

function disposeVideo(video: HTMLVideoElement) {
  try {
    video.pause();
  } catch {
    // ignore
  }
  const src = video.src;
  try {
    video.removeAttribute("src");
    video.load();
  } catch {
    // ignore
  }
  try {
    video.remove();
  } catch {
    // ignore
  }
  if (src && src.startsWith("blob:")) {
    URL.revokeObjectURL(src);
  }
}

function drawEndCard(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  const titleSize = Math.round(Math.min(width, height) * 0.04);
  const urlSize = Math.round(Math.min(width, height) * 0.028);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(SITE_CREDIT_LINE, width / 2, height / 2 - titleSize * 0.85);

  ctx.fillStyle = "#fff";
  ctx.font = `600 ${urlSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(SITE_CREDIT_URL, width / 2, height / 2 + urlSize * 0.55);
}

async function renderEndCard(ctx: CanvasRenderingContext2D): Promise<void> {
  const frameMs = 1000 / OUTPUT_FPS;
  const frames = CLIP_DURATION * OUTPUT_FPS;

  for (let i = 0; i < frames; i++) {
    drawEndCard(ctx);
    await wait(frameMs);
  }
}

function drawMediaFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  stamp: string | null
) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  if (sourceWidth > 0 && sourceHeight > 0) {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const w = sourceWidth * scale;
    const h = sourceHeight * scale;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    ctx.drawImage(source, x, y, w, h);
  }

  if (stamp) {
    const fontSize = Math.round(Math.min(width, height) * 0.045);
    ctx.font = `650 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, fontSize * 0.12);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.fillStyle = "#fff";
    const stampY = height * 0.86;
    ctx.strokeText(stamp, width / 2, stampY);
    ctx.fillText(stamp, width / 2, stampY);
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  stamp: string | null
) {
  drawMediaFrame(ctx, video, video.videoWidth, video.videoHeight, stamp);
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load photo for export"));
    };
    image.src = url;
  });
}

async function renderStillClip(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  stamp: string | null
): Promise<void> {
  const frameMs = 1000 / OUTPUT_FPS;
  const frames = CLIP_DURATION * OUTPUT_FPS;

  for (let i = 0; i < frames; i++) {
    drawMediaFrame(ctx, image, image.naturalWidth, image.naturalHeight, stamp);
    await wait(frameMs);
  }
}

/**
 * Hold a single frame for 1s — reliable fallback when play/seek is flaky on iOS.
 */
async function renderClipStillHold(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  stamp: string | null
): Promise<void> {
  const frameMs = 1000 / OUTPUT_FPS;
  const frames = CLIP_DURATION * OUTPUT_FPS;
  for (let i = 0; i < frames; i++) {
    drawFrame(ctx, video, stamp);
    await wait(frameMs);
  }
}

/**
 * Mobile-safe clip render with a hard per-clip deadline so one bad file
 * can't stall the whole export.
 */
async function renderClipMobile(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  startSeconds: number,
  stamp: string | null
): Promise<void> {
  const maxStart = Math.max(0, (video.duration || CLIP_DURATION) - CLIP_DURATION);
  const start = Math.min(Math.max(0, startSeconds), maxStart);
  const end = start + CLIP_DURATION;

  video.muted = true;
  video.defaultMuted = true;

  const run = async () => {
    await seekVideo(video, start);
    drawFrame(ctx, video, stamp);

    const playing = await playWithTimeout(video, 800);
    if (!playing) {
      await renderClipStillHold(ctx, video, stamp);
      return;
    }

    await new Promise<void>((resolve) => {
      let raf = 0;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(hardStop);
        cancelAnimationFrame(raf);
        try {
          video.pause();
        } catch {
          // ignore
        }
        drawFrame(ctx, video, stamp);
        resolve();
      };

      const tick = () => {
        drawFrame(ctx, video, stamp);
        if (video.ended || video.paused || video.currentTime >= end - 0.01) {
          finish();
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
      const hardStop = window.setTimeout(finish, CLIP_DURATION * 1000 + 300);
    });
  };

  try {
    await Promise.race([
      run(),
      wait(3500).then(() => {
        throw new Error("clip-deadline");
      }),
    ]);
  } catch {
    try {
      video.pause();
    } catch {
      // ignore
    }
    drawFrame(ctx, video, stamp);
    await renderClipStillHold(ctx, video, stamp);
  }
}

async function renderMissingClip(
  ctx: CanvasRenderingContext2D,
  stamp: string | null
): Promise<void> {
  const frameMs = 1000 / OUTPUT_FPS;
  const frames = CLIP_DURATION * OUTPUT_FPS;
  for (let i = 0; i < frames; i++) {
    const { width, height } = ctx.canvas;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);
    if (stamp) {
      const fontSize = Math.round(Math.min(width, height) * 0.045);
      ctx.font = `650 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(stamp, width / 2, height * 0.86);
    }
    await wait(frameMs);
  }
}

/**
 * Play the source in real time and paint every animation frame.
 * Used on desktop; mobile uses a timeout-guarded path instead.
 */
async function renderClipRealtime(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  startSeconds: number,
  stamp: string | null,
  audioDest: MediaStreamAudioDestinationNode | null
): Promise<void> {
  const maxStart = Math.max(0, (video.duration || CLIP_DURATION) - CLIP_DURATION);
  const start = Math.min(Math.max(0, startSeconds), maxStart);
  const end = start + CLIP_DURATION;

  await seekVideo(video, start);
  drawFrame(ctx, video, stamp);

  let source: MediaElementAudioSourceNode | null = null;
  if (audioDest && (audioDest.context.state as string) === "running") {
    try {
      video.muted = false;
      video.volume = 1;
      const audioContext = audioDest.context as AudioContext;
      source = audioContext.createMediaElementSource(video);
      source.connect(audioDest);
    } catch {
      video.muted = true;
    }
  } else {
    video.muted = true;
  }

  const playing = await playWithTimeout(video, 2000);
  if (!playing) {
    video.muted = true;
    await renderClipStillHold(ctx, video, stamp);
    if (source) {
      try {
        source.disconnect();
      } catch {
        // ignore
      }
    }
    return;
  }

  await new Promise<void>((resolve) => {
    let raf = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(hardStop);
      cancelAnimationFrame(raf);
      try {
        video.pause();
      } catch {
        // ignore
      }
      drawFrame(ctx, video, stamp);
      resolve();
    };

    const tick = () => {
      drawFrame(ctx, video, stamp);

      if (video.ended || video.paused || video.currentTime >= end - 0.01) {
        finish();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const hardStop = window.setTimeout(finish, CLIP_DURATION * 1000 + 400);
  });

  if (source) {
    try {
      source.disconnect();
    } catch {
      // ignore
    }
  }
}

async function renderVideoClip(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  startSeconds: number,
  stamp: string | null,
  audioDest: MediaStreamAudioDestinationNode | null
): Promise<void> {
  if (isAppleTouchDevice()) {
    await renderClipMobile(ctx, video, startSeconds, stamp);
    return;
  }

  await renderClipRealtime(ctx, video, startSeconds, stamp, audioDest);
}

export async function compileOneSecondVideo({
  clips,
  showDateStamp,
  orientation,
  onProgress,
}: CompileOptions): Promise<{ blob: Blob; extension: string }> {
  if (clips.length === 0) {
    throw new Error("No clips to export");
  }

  onProgress?.(0.02, "Preparing…");

  // Full HD realtime encode is heavy on phones; slightly smaller is much more reliable.
  const full = outputSizeForOrientation(orientation);
  const scale = isAppleTouchDevice() ? 0.6667 : 1;
  const width = Math.round(full.width * scale / 2) * 2;
  const height = Math.round(full.height * scale / 2) * 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unsupported");

  onProgress?.(0.04, "Starting recorder…");

  const canvasStream = canvas.captureStream(OUTPUT_FPS);

  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  // After the download await we're outside the user-gesture window. iOS often
  // leaves AudioContext suspended forever — never block export on resume.
  // Skip audio entirely on iPhone/iPad: MediaElementSource + multi-clip hangs.
  if (!isAppleTouchDevice()) {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AC();
      const running = await resumeAudioContext(audioCtx);
      if (running) {
        audioDest = audioCtx.createMediaStreamDestination();
      } else {
        await audioCtx.close().catch(() => undefined);
        audioCtx = null;
        audioDest = null;
      }
    } catch {
      audioCtx = null;
      audioDest = null;
    }
  }

  const tracks = [
    ...canvasStream.getVideoTracks(),
    ...(audioDest ? audioDest.stream.getAudioTracks() : []),
  ];
  const combined = new MediaStream(tracks);

  const mimeType = pickMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(combined, {
          mimeType,
          videoBitsPerSecond: isAppleTouchDevice() ? 6_000_000 : 12_000_000,
        })
      : new MediaRecorder(combined);
  } catch {
    // Retry video-only — some mobile engines reject audio+canvas combos.
    const videoOnly = new MediaStream(canvasStream.getVideoTracks());
    recorder = mimeType
      ? new MediaRecorder(videoOnly, { mimeType })
      : new MediaRecorder(videoOnly);
    if (audioCtx) {
      await audioCtx.close().catch(() => undefined);
      audioCtx = null;
      audioDest = null;
    }
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const recordedType = recorder.mimeType || mimeType || "video/mp4";

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Recording failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recordedType }));
  });

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  recorder.start(250);

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    onProgress?.(
      (i + 0.1) / clips.length,
      `Rendering ${i + 1} of ${clips.length}…`
    );

    const stamp = showDateStamp ? formatStamp(clip.dayKey) : null;

    try {
      if (clip.kind === "photo") {
        const image = await loadImage(clip.blob);
        await renderStillClip(ctx, image, stamp);
      } else {
        const video = await loadVideo(clip.blob);
        try {
          await renderVideoClip(
            ctx,
            video,
            clip.startSeconds,
            stamp,
            audioDest
          );
        } finally {
          disposeVideo(video);
        }
      }
    } catch {
      // Keep going — one unreadable Google clip shouldn't kill the export.
      onProgress?.(
        (i + 0.5) / clips.length,
        `Skipping clip ${i + 1}…`
      );
      await renderMissingClip(ctx, stamp);
    }

    // Drop the downloaded bytes so iOS isn't holding 14 full videos at once.
    try {
      (clips[i] as { blob: Blob | null }).blob = null as unknown as Blob;
    } catch {
      // ignore
    }

    // Give iOS a beat to release decoder resources between clips.
    await wait(isAppleTouchDevice() ? 120 : 30);
  }

  onProgress?.(0.92, "Adding credit…");
  await renderEndCard(ctx);

  onProgress?.(0.96, "Finishing export…");
  await wait(200);
  recorder.stop();
  canvasStream.getTracks().forEach((track) => track.stop());

  const blob = await stopped;
  if (audioCtx) await audioCtx.close().catch(() => undefined);

  if (blob.size === 0) {
    throw new Error("Export produced an empty video — try fewer clips");
  }

  const typeHint = `${blob.type} ${recordedType} ${mimeType}`.toLowerCase();
  const looksMp4 = typeHint.includes("mp4") || typeHint.includes("avc1");
  const looksWebm = typeHint.includes("webm");
  const onPhone =
    isAppleTouchDevice() ||
    (typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches);

  // Safari records MP4 natively. Even when mime strings are empty/odd, prefer
  // treating Apple recordings as MP4 and never run ffmpeg.wasm on phones —
  // it hangs on "Encoding MP4…".
  if (looksMp4 || (onPhone && !looksWebm)) {
    onProgress?.(1, "Done");
    return {
      blob: blob.type.includes("mp4")
        ? blob
        : new Blob([blob], { type: "video/mp4" }),
      extension: "mp4",
    };
  }

  if (onPhone) {
    onProgress?.(1, "Done");
    return {
      blob: looksWebm ? blob : new Blob([blob], { type: "video/mp4" }),
      extension: looksWebm ? "webm" : "mp4",
    };
  }

  onProgress?.(0.97, "Converting to MP4…");
  try {
    const { convertBlobToMp4 } = await import("@/src/lib/convertToMp4");
    const mp4 = await Promise.race([
      convertBlobToMp4(blob, (ratio, label) => {
        onProgress?.(0.97 + ratio * 0.03, label);
      }),
      wait(90_000).then(() => {
        throw new Error("MP4 encode timed out");
      }),
    ]);
    onProgress?.(1, "Done");
    return { blob: mp4, extension: "mp4" };
  } catch {
    onProgress?.(1, "Done");
    return { blob, extension: looksWebm ? "webm" : "mp4" };
  }
}
