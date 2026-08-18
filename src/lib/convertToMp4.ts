import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { convertWebmToMp4 } from "@/src/lib/encodeMp4";

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

function resetFfmpeg() {
  try {
    ffmpegSingleton?.terminate();
  } catch {
    // ignore
  }
  ffmpegSingleton = null;
  loadPromise = null;
}

async function getFfmpeg(
  onProgress?: (ratio: number, label: string) => void
): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;

  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpegSingleton = ffmpeg;

      ffmpeg.on("progress", ({ progress }) => {
        const ratio = Math.min(1, Math.max(0, progress));
        onProgress?.(ratio, "Encoding MP4…");
      });

      onProgress?.(0.05, "Loading MP4 encoder…");

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });

      return ffmpeg;
    })().catch((err) => {
      loadPromise = null;
      ffmpegSingleton = null;
      throw err;
    });
  }

  return loadPromise;
}

async function convertWithFfmpeg(
  input: Blob,
  onProgress?: (ratio: number, label: string) => void
): Promise<Blob> {
  const ffmpeg = await getFfmpeg(onProgress);
  const inputName = input.type.includes("webm") ? "input.webm" : "input.mkv";

  onProgress?.(0.1, "Encoding MP4…");
  await ffmpeg.writeFile(inputName, await fetchFile(input));

  try {
    await ffmpeg.exec([
      "-i",
      inputName,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      "output.mp4",
    ]);
  } catch {
    await ffmpeg.exec([
      "-i",
      inputName,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      "output.mp4",
    ]);
  }

  const data = await ffmpeg.readFile("output.mp4");
  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await ffmpeg.deleteFile("output.mp4").catch(() => undefined);

  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  onProgress?.(1, "Done");
  return new Blob([copy], { type: "video/mp4" });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("MP4 conversion timed out")),
          ms
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function convertBlobToMp4(
  input: Blob,
  onProgress?: (ratio: number, label: string) => void,
  timeoutMs = 25_000
): Promise<Blob> {
  if (input.type.includes("mp4") || input.type.includes("quicktime")) {
    return input;
  }

  try {
    return await convertWebmToMp4(input, onProgress, timeoutMs);
  } catch {
    try {
      return await withTimeout(convertWithFfmpeg(input, onProgress), timeoutMs);
    } catch (error) {
      resetFfmpeg();
      throw error;
    }
  }
}
