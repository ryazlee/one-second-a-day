import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeVideo,
} from "mediabunny";

const FRAME_DURATION = 1 / 30;

export async function canEncodeCanvasMp4(
  width: number,
  height: number
): Promise<boolean> {
  try {
    return await canEncodeVideo("avc", {
      width,
      height,
      quality: new Quality({ bitrate: 6_000_000 }),
    });
  } catch {
    return false;
  }
}

export type CanvasMp4Session = {
  addFrame: () => Promise<void>;
  finalize: () => Promise<Blob>;
  cancel: () => void;
};

export async function createCanvasMp4Session(
  canvas: HTMLCanvasElement,
  bitrate: number
): Promise<CanvasMp4Session | null> {
  const ok = await canEncodeCanvasMp4(canvas.width, canvas.height);
  if (!ok) return null;

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });

  const source = new CanvasSource(canvas, {
    codec: "avc",
    quality: new Quality({ bitrate, bitrateMode: "variable" }),
    keyFrameInterval: 1,
  });

  output.addVideoTrack(source);
  await output.start();

  let timestamp = 0;
  let closed = false;

  return {
    async addFrame() {
      if (closed) throw new Error("Encoder already closed");
      await source.add(timestamp, FRAME_DURATION);
      timestamp += FRAME_DURATION;
    },
    async finalize() {
      if (closed) throw new Error("Encoder already closed");
      closed = true;
      source.close();
      await output.finalize();
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength < 32) {
        throw new Error("Export produced an empty video — try fewer clips");
      }
      return new Blob([buffer], { type: "video/mp4" });
    },
    cancel() {
      if (closed) return;
      closed = true;
      try {
        source.close();
      } catch {
        // ignore
      }
      void output.cancel().catch(() => undefined);
    },
  };
}

export async function convertWebmToMp4(
  input: Blob,
  onProgress?: (ratio: number, label: string) => void,
  timeoutMs = 25_000
): Promise<Blob> {
  if (input.type.includes("mp4") || input.type.includes("quicktime")) {
    return input;
  }

  const convert = (async () => {
    const source = new Input({
      source: new BlobSource(input),
      formats: ALL_FORMATS,
    });
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });

    const conversion = await Conversion.init({
      input: source,
      output,
      video: {
        codec: "avc",
        quality: new Quality({ bitrate: 8_000_000 }),
      },
      audio: { discard: true },
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error("This browser can’t convert the export to MP4");
    }

    conversion.onProgress = (progress) => {
      onProgress?.(Math.min(1, Math.max(0, progress)), "Converting to MP4…");
    };

    await conversion.execute();
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength < 32) {
      throw new Error("MP4 conversion produced an empty file");
    }
    return new Blob([buffer], { type: "video/mp4" });
  })();

  let timeoutId = 0;
  try {
    return await Promise.race([
      convert,
      new Promise<Blob>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("MP4 conversion timed out")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
