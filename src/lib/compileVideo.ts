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

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "video/webm";
}

function loadVideo(blob: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = URL.createObjectURL(blob);

    const cleanup = () => {
      video.onloadeddata = null;
      video.onerror = null;
    };

    video.onloadeddata = () => {
      cleanup();
      resolve(video);
    };
    video.onerror = () => {
      cleanup();
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
  if (audioDest) {
    try {
      video.muted = false;
      video.volume = 1;
      const ctx = audioDest.context as AudioContext;
      source = ctx.createMediaElementSource(video);
      source.connect(audioDest);
    } catch {
      video.muted = true;
    }
  } else {
    video.muted = true;
  }

  await video.play();

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

  const { width, height } = outputSizeForOrientation(orientation);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unsupported");

  const canvasStream = canvas.captureStream(OUTPUT_FPS);

  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    audioDest = audioCtx.createMediaStreamDestination();
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
  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: 12_000_000,
    audioBitsPerSecond: 192_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Recording failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  recorder.start(50);

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
    // Tiny hold so clip boundaries don't glitch.
    await wait(30);
  }

  onProgress?.(0.92, "Adding credit…");
  await renderEndCard(ctx);

  onProgress?.(0.96, "Finishing export…");
  await wait(150);
  recorder.stop();
  canvasStream.getTracks().forEach((track) => track.stop());

  const blob = await stopped;
  if (audioCtx) await audioCtx.close().catch(() => undefined);

  if (blob.type.includes("mp4")) {
    onProgress?.(1, "Done");
    return { blob, extension: "mp4" };
  }

  onProgress?.(0.97, "Converting to MP4…");
  const { convertBlobToMp4 } = await import("@/src/lib/convertToMp4");
  const mp4 = await convertBlobToMp4(blob, (ratio, label) => {
    onProgress?.(0.97 + ratio * 0.03, label);
  });

  onProgress?.(1, "Done");
  return { blob: mp4, extension: "mp4" };
}
