export type PhotoMetadata = {
  apertureFNumber?: number;
  exposureTime?: string;
  focalLength?: number;
  isoEquivalent?: number;
};

export type VideoMetadata = {
  fps?: number;
  processingStatus?: "UNSPECIFIED" | "PROCESSING" | "READY" | "FAILED";
};

export type MediaFileMetadata = {
  cameraMake?: string;
  cameraModel?: string;
  width: number;
  height: number;
  photoMetadata?: PhotoMetadata;
  videoMetadata?: VideoMetadata;
};

export type MediaFile = {
  baseUrl: string;
  filename: string;
  mimeType: string;
  mediaFileMetadata: MediaFileMetadata;
};

export type MediaItem = {
  id: string;
  createTime: string;
  type: "PHOTO" | "VIDEO";
  mediaFile: MediaFile;
};

/** One exported second from a single media item. */
export type ClipSelection = {
  mediaId: string;
  startSeconds: number;
};

export type DaySelection = {
  dayKey: string;
  included: boolean;
  /** Ordered clips for this day. Length is 1 when one-per-day is on. */
  clips: ClipSelection[];
};

export type ExportOrientation = "portrait" | "landscape";
