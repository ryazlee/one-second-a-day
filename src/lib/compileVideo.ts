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
    const url = URL.createObjectURL(blob);
    video.src = url;

    const cleanup = () => {
      video.onloadeddata = null;
      video.onerror = null;
      window.clearTimeout(timeout);
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("Timed out loading video for export"));
    }, 30_000);

    video.onloadeddata = () => {
      cleanup();
      resolve(video);
    };
    video.onerror = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video for export"));
    };
  });
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.min(
    Math.max(0, time),
    Math.max(0, (video.duration || 0) - 0.001)
  );

  if (Math.abs(video.currentTime - target) < 0.01) return;

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("Seek failed"));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = target;
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Play the source in real time and paint every animation frame.
 * Much smoother than seeking frame-by-frame.
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
  if (audioDest && audioDest.context.state === "running") {
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

  try {
    await video.play();
  } catch {
    // iOS can reject play() after long async work; keep painting frames anyway.
    video.muted = true;
    await video.play().catch(() => undefined);
  }

  await new Promise<void>((resolve) => {
    let raf = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(hardStop);
      cancelAnimationFrame(raf);
      video.pause();
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

    const hardStop = window.setTimeout(finish, CLIP_DURATION * 1000 + 200);
  });

  if (source) {
    try {
      source.disconnect();
    } catch {
      // ignore
    }
  }
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

    if (clip.kind === "photo") {
      const image = await loadImage(clip.blob);
      await renderStillClip(ctx, image, stamp);
    } else {
      const video = await loadVideo(clip.blob);
      await renderClipRealtime(ctx, video, clip.startSeconds, stamp, audioDest);
      URL.revokeObjectURL(video.src);
    }
    await wait(30);
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

  if (blob.type.includes("mp4") || recordedType.includes("mp4")) {
    onProgress?.(1, "Done");
    return {
      blob: blob.type.includes("mp4")
        ? blob
        : new Blob([blob], { type: "video/mp4" }),
      extension: "mp4",
    };
  }

  onProgress?.(0.97, "Converting to MP4…");
  try {
    const { convertBlobToMp4 } = await import("@/src/lib/convertToMp4");
    const mp4 = await convertBlobToMp4(blob, (ratio, label) => {
      onProgress?.(0.97 + ratio * 0.03, label);
    });
    onProgress?.(1, "Done");
    return { blob: mp4, extension: "mp4" };
  } catch {
    // Mobile WebM→MP4 via ffmpeg.wasm often fails; share the recorded blob anyway.
    onProgress?.(1, "Done");
    return { blob, extension: blob.type.includes("webm") ? "webm" : "mp4" };
  }
}
