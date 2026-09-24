"use client";

/**
 * Clientseitige Vorverkleinerung (spart Datenvolumen auf der Baustelle, wandelt HEIC in JPEG,
 * sofern der Browser HEIC darstellen kann). Serverseitig wird zusätzlich validiert und neu kodiert.
 */
export async function compressImage(file: File | Blob, maxSize = 2048, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
