import { describe, expect, it } from "vitest";
import { encodeUnderLimit, fitWithin, MAX_PHOTO_BYTES } from "@/lib/media/resize";

const blob = (type: string, size: number) => ({ type, size }) as Blob;

describe("REQ-038.1 reducir la foto antes de subirla (design.md §11.3)", () => {
  it("REQ-038.1 el lado mayor queda en 1080 px y conserva la proporción", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1080, height: 810 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 810, height: 1080 });
    expect(fitWithin(2160, 2160)).toEqual({ width: 1080, height: 1080 });
  });

  it("REQ-038.1 una foto pequeña no se agranda", () => {
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(1080, 200)).toEqual({ width: 1080, height: 200 });
  });

  it("REQ-038.1 baja la calidad hasta quedar en 300 KB o menos", async () => {
    const seen: number[] = [];
    const out = await encodeUnderLimit(async (type, q) => {
      seen.push(q);
      return blob(type, q > 0.6 ? MAX_PHOTO_BYTES + 1 : MAX_PHOTO_BYTES);
    });
    expect(out?.size).toBe(MAX_PHOTO_BYTES);
    expect(out?.type).toBe("image/webp");
    expect(Math.min(...seen)).toBeLessThanOrEqual(0.6);
  });

  it("REQ-038.1 Safari no codifica WebP (entrega PNG): usa JPEG", async () => {
    const asked: string[] = [];
    const out = await encodeUnderLimit(async (type) => {
      asked.push(type);
      return blob(type === "image/webp" ? "image/png" : type, 1000);
    });
    expect(out?.type).toBe("image/jpeg");
    expect(asked.at(-1)).toBe("image/jpeg");
  });

  it("REQ-038.1 sin forma de quedar por debajo del límite devuelve null", async () => {
    expect(await encodeUnderLimit(async (type) => blob(type, MAX_PHOTO_BYTES + 1))).toBeNull();
    expect(await encodeUnderLimit(async () => null)).toBeNull();
  });
});
