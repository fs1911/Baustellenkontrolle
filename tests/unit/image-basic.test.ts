import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { BasicImageError, detectFormat, inspectImage } from "@/lib/services/image-basic";

const opts = { stripMetadata: true, allowed: ["jpeg", "png"] as ("jpeg" | "png")[], maxPixels: 50_000_000 };

async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 640, height: 480, channels: 3, background: "#7a8fa6" } })
    .jpeg({ quality: 80 })
    .withMetadata({
      exif: { IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "47/1 23/1 0/1" } },
    })
    .toBuffer();
}

describe("Bildprüfung ohne native Bibliothek (Workers)", () => {
  it("erkennt Formate anhand der Signatur, nicht der Endung", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } })
      .png()
      .toBuffer();
    expect(detectFormat(await jpegWithGps())).toBe("jpeg");
    expect(detectFormat(png)).toBe("png");
    expect(detectFormat(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("liest Abmessungen und entfernt EXIF inkl. GPS, Bild bleibt gültig", async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = inspectImage(input, opts);
    expect(out).toMatchObject({ format: "jpeg", width: 640, height: 480 });
    const meta = await sharp(Buffer.from(out.data)).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(640);
  });

  it("behält Metadaten, wenn die Entfernung deaktiviert ist", async () => {
    const out = inspectImage(await jpegWithGps(), { ...opts, stripMetadata: false });
    expect((await sharp(Buffer.from(out.data)).metadata()).exif).toBeDefined();
  });

  it("entfernt Text-Chunks aus PNG", async () => {
    const png = await sharp({ create: { width: 30, height: 20, channels: 4, background: "#123456" } })
      .png()
      .withMetadata({ exif: { IFD0: { Copyright: "Geheim" } } })
      .toBuffer();
    const out = inspectImage(png, opts);
    expect(out).toMatchObject({ format: "png", width: 30, height: 20 });
    expect(Buffer.from(out.data).includes("Geheim")).toBe(false);
    expect((await sharp(Buffer.from(out.data)).metadata()).width).toBe(30);
  });

  it("lehnt nicht erlaubte, beschädigte und zu grosse Bilder ab", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } })
      .png()
      .toBuffer();
    expect(() => inspectImage(png, { ...opts, allowed: ["jpeg"] })).toThrow(BasicImageError);
    const jpg = await jpegWithGps();
    expect(() => inspectImage(jpg.subarray(0, 40), opts)).toThrow(BasicImageError);
    expect(() => inspectImage(jpg, { ...opts, maxPixels: 1000 })).toThrow(/zu gross/);
    expect(() => inspectImage(Buffer.from("GIF89a"), opts)).toThrow(BasicImageError);
  });
});
