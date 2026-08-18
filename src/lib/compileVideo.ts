import { convertBlobToMp4 } from "@/src/lib/convertToMp4";
import { formatStamp } from "@/src/lib/dates";
import {
  CanvasMp4Session,
  createCanvasMp4Session,
} from "@/src/lib/encodeMp4";
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

  // Safari / iOS: MP4 (H.264). Chrome: try MP4 first, then WebM.
  const candidates = isAppleTouchDevice()
    ? ["video/mp4", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm"]
    : [
        "video/mp4",
        "video/mp4;codecs=avc1.4D401F",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
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
      try {
        video.pause();
      } catch {
        // ignore
      }
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
      isAppleTouchDevice() ? 15_000 : 20_000
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
    // Do not pause after `succeed()`: that race froze every exported clip.
    void video
      .play()
      .then(() => {
        if (settled) return;
        try {
          video.pause();
        } catch {
          // ignore
        }
        maybeReady();
      })
      .catch(() => maybeReady());
  });
}

async function seekVideo(
  video: HTMLVideoElement,
  time: number,
  options?: { force?: boolean }
): Promise<void> {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return;

  const target = Math.min(
    Math.max(0, time),
    Math.max(0, video.duration - 0.05)
  );

  if (!options?.force && Math.abs(video.currentTime - target) < 0.02) return;

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
    const timeout = window.setTimeout(
      finish,
      isAppleTouchDevice() ? 1500 : 400
    );
    video.addEventListener("seeked", finish);
    video.addEventListener("error", finish);
    try {
      video.pause();
    } catch {
      // ignore
    }
    try {
      video.currentTime = target;
    } catch {
      finish();
    }
  });
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const el = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    if (typeof el.requestVideoFrameCallback === "function") {
      const handle = el.requestVideoFrameCallback(() => {
        window.clearTimeout(timeout);
        resolve();
      });
      const timeout = window.setTimeout(() => {
        el.cancelVideoFrameCallback?.(handle);
        resolve();
      }, 80);
      return;
    }
    window.setTimeout(resolve, 16);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pauseRecorder(recorder: MediaRecorder) {
  try {
    if (recorder.state === "recording") recorder.pause();
  } catch {
    // ignore
  }
}

function resumeRecorder(recorder: MediaRecorder) {
  try {
    if (recorder.state === "paused") recorder.resume();
  } catch {
    // ignore
  }
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

/** Record exactly `CLIP_DURATION` of wall-clock while the source plays at 1x. */
async function capturePlayingClip(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  _end: number,
  stamp: string | null
): Promise<void> {
  await new Promise<void>((resolve) => {
    let raf = 0;
    let settled = false;
    const startedAt = performance.now();

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
      const elapsed = performance.now() - startedAt;
      // Keep painting for the full second even if playback stalls — finishing
      // early made MediaRecorder store a single still.
      if (elapsed >= CLIP_DURATION * 1000 || video.ended) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    // Hard cap at exactly one second — no padding that stretches pacing.
    const hardStop = window.setTimeout(finish, CLIP_DURATION * 1000);
  });
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
 *
 * MediaRecorder stays paused during seek/play setup so load stalls aren't
 * baked in as slow-mo. Only the real 1s of 1x playback is recorded.
 */
async function renderClipMobile(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  startSeconds: number,
  stamp: string | null,
  recorder: MediaRecorder
): Promise<void> {
  const maxStart = Math.max(0, (video.duration || CLIP_DURATION) - CLIP_DURATION);
  const start = Math.min(Math.max(0, startSeconds), maxStart);
  const end = start + CLIP_DURATION;

  video.muted = true;
  video.defaultMuted = true;
  video.playbackRate = 1;

  const run = async () => {
    pauseRecorder(recorder);
    await seekVideo(video, start);
    drawFrame(ctx, video, stamp);

    const playing = await playWithTimeout(video, 1500);
    if (!playing) {
      resumeRecorder(recorder);
      await renderClipStillHold(ctx, video, stamp);
      return;
    }

    resumeRecorder(recorder);
    await capturePlayingClip(ctx, video, end, stamp);
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
    pauseRecorder(recorder);
    drawFrame(ctx, video, stamp);
    resumeRecorder(recorder);
    await renderClipStillHold(ctx, video, stamp);
  } finally {
    pauseRecorder(recorder);
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
 * Play the source at 1x and paint every animation frame.
 * Recorder is paused during seek/play setup so only real playback is recorded.
 */
async function renderClipRealtime(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  startSeconds: number,
  stamp: string | null,
  audioDest: MediaStreamAudioDestinationNode | null,
  recorder: MediaRecorder
): Promise<void> {
  const maxStart = Math.max(0, (video.duration || CLIP_DURATION) - CLIP_DURATION);
  const start = Math.min(Math.max(0, startSeconds), maxStart);
  const end = start + CLIP_DURATION;

  video.playbackRate = 1;

  pauseRecorder(recorder);
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
    resumeRecorder(recorder);
    await renderClipStillHold(ctx, video, stamp);
    pauseRecorder(recorder);
    if (source) {
      try {
        source.disconnect();
      } catch {
        // ignore
      }
    }
    return;
  }

  resumeRecorder(recorder);
  await capturePlayingClip(ctx, video, end, stamp);
  pauseRecorder(recorder);

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
  audioDest: MediaStreamAudioDestinationNode | null,
  recorder: MediaRecorder
): Promise<void> {
  if (isAppleTouchDevice()) {
    await renderClipMobile(ctx, video, startSeconds, stamp, recorder);
    return;
  }

  await renderClipRealtime(
    ctx,
    video,
    startSeconds,
    stamp,
    audioDest,
    recorder
  );
}

async function emitStillFrames(
  draw: () => void,
  session: CanvasMp4Session
) {
  for (let i = 0; i < OUTPUT_FPS; i++) {
    draw();
    await session.addFrame();
  }
}

async function snapshotCanvas(
  ctx: CanvasRenderingContext2D
): Promise<ImageBitmap> {
  return createImageBitmap(ctx.canvas);
}

async function captureClipSnapshots(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  start: number,
  stamp: string | null
): Promise<ImageBitmap[]> {
  try {
    video.pause();
  } catch {
    // ignore
  }

  await seekVideo(video, start, { force: true });
  await waitForVideoFrame(video);
  drawFrame(ctx, video, stamp);

  const playing = await playWithTimeout(video, 2000);
  if (!playing) {
    return captureClipByStepping(ctx, video, start, stamp);
  }

  const snaps: ImageBitmap[] = [];
  const mediaStart = video.currentTime;
  const deadline = performance.now() + CLIP_DURATION * 1000 + 500;

  while (snaps.length < OUTPUT_FPS && performance.now() < deadline) {
    const desired = start + (snaps.length + 0.5) / OUTPUT_FPS;
    if (
      video.currentTime + 0.012 < desired &&
      !video.paused &&
      !video.ended
    ) {
      await wait(8);
      continue;
    }

    if (video.paused && snaps.length < 4) {
      await playWithTimeout(video, 300);
    }

    drawFrame(ctx, video, stamp);
    snaps.push(await snapshotCanvas(ctx));
  }

  try {
    video.pause();
  } catch {
    // ignore
  }

  if (video.currentTime - mediaStart < 0.2 && snaps.length > 0) {
    for (const snap of snaps) snap.close();
    return captureClipByStepping(ctx, video, start, stamp);
  }

  while (snaps.length < OUTPUT_FPS) {
    drawFrame(ctx, video, stamp);
    snaps.push(await snapshotCanvas(ctx));
  }

  return snaps;
}

async function captureClipByStepping(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  start: number,
  stamp: string | null
): Promise<ImageBitmap[]> {
  const snaps: ImageBitmap[] = [];
  try {
    video.pause();
  } catch {
    // ignore
  }

  for (let i = 0; i < OUTPUT_FPS; i++) {
    const t = start + (i + 0.5) / OUTPUT_FPS;
    await seekVideo(video, t, { force: true });
    await waitForVideoFrame(video);
    drawFrame(ctx, video, stamp);
    snaps.push(await snapshotCanvas(ctx));
  }

  return snaps;
}

async function emitSnapshots(
  ctx: CanvasRenderingContext2D,
  snaps: ImageBitmap[],
  session: CanvasMp4Session
) {
  for (const snap of snaps) {
    ctx.drawImage(snap, 0, 0, ctx.canvas.width, ctx.canvas.height);
    await session.addFrame();
    snap.close();
  }
}

async function renderCanvasVideoClip(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  startSeconds: number,
  stamp: string | null,
  session: CanvasMp4Session
) {
  const maxStart = Math.max(0, (video.duration || CLIP_DURATION) - CLIP_DURATION);
  const start = Math.min(Math.max(0, startSeconds), maxStart);

  video.muted = true;
  video.defaultMuted = true;
  video.playbackRate = 1;

  const snaps = await captureClipSnapshots(ctx, video, start, stamp);
  await emitSnapshots(ctx, snaps, session);
}

async function compileWithCanvasMp4({
  clips,
  showDateStamp,
  onProgress,
  ctx,
  session,
}: {
  clips: CompileClip[];
  showDateStamp: boolean;
  onProgress?: (ratio: number, label: string) => void;
  ctx: CanvasRenderingContext2D;
  session: CanvasMp4Session;
}): Promise<{ blob: Blob; extension: string }> {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    onProgress?.(
      (i + 0.1) / (clips.length + 1),
      `Rendering ${i + 1} of ${clips.length}…`
    );
    const stamp = showDateStamp ? formatStamp(clip.dayKey) : null;

    try {
      if (clip.kind === "photo") {
        const image = await loadImage(clip.blob);
        await emitStillFrames(
          () =>
            drawMediaFrame(
              ctx,
              image,
              image.naturalWidth,
              image.naturalHeight,
              stamp
            ),
          session
        );
      } else {
        const video = await loadVideo(clip.blob);
        try {
          await renderCanvasVideoClip(
            ctx,
            video,
            clip.startSeconds,
            stamp,
            session
          );
        } finally {
          disposeVideo(video);
        }
      }
    } catch {
      onProgress?.((i + 0.5) / (clips.length + 1), `Skipping clip ${i + 1}…`);
      await emitStillFrames(() => {
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
      }, session);
    }
  }

  onProgress?.(0.92, "Adding credit…");
  await emitStillFrames(() => drawEndCard(ctx), session);

  onProgress?.(0.96, "Finishing export…");
  const blob = await session.finalize();
  onProgress?.(1, "Done");
  return { blob, extension: "mp4" };
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

  // Chrome/Android: encode real MP4 via WebCodecs so Save to Photos works.
  // iOS already gets MP4 from MediaRecorder, which is more reliable there.
  if (!isAppleTouchDevice()) {
    onProgress?.(0.04, "Starting encoder…");
    const session = await createCanvasMp4Session(
      canvas,
      10_000_000
    ).catch(() => null);
    if (session) {
      try {
        return await compileWithCanvasMp4({
          clips,
          showDateStamp,
          onProgress,
          ctx,
          session,
        });
      } catch {
        session.cancel();
      }
    }
  }

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
  // Stay paused while loading/seeking so setup time isn't baked into playback speed.
  pauseRecorder(recorder);

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
        resumeRecorder(recorder);
        await renderStillClip(ctx, image, stamp);
        pauseRecorder(recorder);
      } else {
        const video = await loadVideo(clip.blob);
        try {
          await renderVideoClip(
            ctx,
            video,
            clip.startSeconds,
            stamp,
            audioDest,
            recorder
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
      resumeRecorder(recorder);
      await renderMissingClip(ctx, stamp);
      pauseRecorder(recorder);
    }

    // Drop the downloaded bytes so iOS isn't holding 14 full videos at once.
    try {
      (clips[i] as { blob: Blob | null }).blob = null as unknown as Blob;
    } catch {
      // ignore
    }

    // Give iOS a beat to release decoder resources between clips (recorder paused).
    await wait(isAppleTouchDevice() ? 120 : 30);
  }

  onProgress?.(0.92, "Adding credit…");
  resumeRecorder(recorder);
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

  if (looksMp4) {
    const mime = "video/mp4";
    onProgress?.(1, "Done");
    return {
      blob: blob.type === mime ? blob : new Blob([blob], { type: mime }),
      extension: "mp4",
    };
  }

  onProgress?.(0.97, "Converting to MP4…");
  try {
    const mp4 = await convertBlobToMp4(blob, (ratio, label) => {
      onProgress?.(0.97 + ratio * 0.03, label);
    });
    onProgress?.(1, "Done");
    return { blob: mp4, extension: "mp4" };
  } catch {
    const mime = "video/webm";
    onProgress?.(1, "Done");
    return {
      blob: blob.type === mime ? blob : new Blob([blob], { type: mime }),
      extension: "webm",
    };
  }
}
