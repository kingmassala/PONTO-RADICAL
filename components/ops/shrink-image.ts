/** Reduz fotografias no telemóvel (máx. 2000 px, JPEG 82%) antes de enviar: poupa dados móveis. */
export async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
