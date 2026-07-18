import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegSingleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

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

      // Single-thread core — no COOP/COEP required (OAuth popups stay intact).
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

export async function convertBlobToMp4(
  input: Blob,
  onProgress?: (ratio: number, label: string) => void
): Promise<Blob> {
  if (input.type.includes("mp4")) {
    return input;
  }

  const ffmpeg = await getFfmpeg(onProgress);
  const inputName = input.type.includes("webm") ? "input.webm" : "input.mkv";

  onProgress?.(0.1, "Encoding MP4…");
  await ffmpeg.writeFile(inputName, await fetchFile(input));

  const args = [
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
  ];

  try {
    await ffmpeg.exec(args);
  } catch {
    // Retry without audio if the recording had no usable audio track.
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

  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  onProgress?.(1, "Done");
  return new Blob([copy], { type: "video/mp4" });
}
