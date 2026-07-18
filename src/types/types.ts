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

export type DaySelection = {
  dayKey: string;
  mediaId: string;
  startSeconds: number;
  included: boolean;
};

export type ExportOrientation = "portrait" | "landscape";
