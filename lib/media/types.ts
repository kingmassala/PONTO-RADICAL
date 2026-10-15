export type MediaItem = {
  id: string;
  url: string;
  kind: "image" | "video";
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  folder: string;
  originalName: string | null;
  createdAt: string;
};
