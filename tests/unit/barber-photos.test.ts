import { describe, expect, it } from "vitest";
import {
  checkPhotoUpload,
  NOT_A_PHOTO_ERROR,
  PHOTO_CONSENT_ERROR,
  PHOTO_TOO_BIG_ERROR,
} from "@/lib/media/barber-photos";
import { newBarberPhotoPath } from "@/lib/media/paths";
import { MAX_PHOTO_BYTES } from "@/lib/media/resize";

const BIZ = "11111111-1111-4111-8111-111111111111";
const BARBER = "22222222-2222-4222-8222-222222222222";
const ok = { consent: true, type: "image/webp", size: 1000 };

describe("REQ-039 validar la foto antes de guardarla (design.md §11.3)", () => {
  it("REQ-039.3 sin confirmar el permiso del cliente no se sube", () => {
    expect(checkPhotoUpload({ ...ok, consent: false })).toBe(PHOTO_CONSENT_ERROR);
  });

  it("REQ-039.4 un archivo que no es imagen se rechaza", () => {
    expect(checkPhotoUpload({ ...ok, type: "application/pdf" })).toBe(NOT_A_PHOTO_ERROR);
    expect(checkPhotoUpload({ ...ok, type: "" })).toBe(NOT_A_PHOTO_ERROR);
    expect(checkPhotoUpload({ ...ok, size: 0 })).toBe(NOT_A_PHOTO_ERROR);
    expect(NOT_A_PHOTO_ERROR).toBe("Ese archivo no es una foto");
  });

  it("REQ-039.4 el servidor rechaza más de 300 KB", () => {
    expect(checkPhotoUpload({ ...ok, size: MAX_PHOTO_BYTES })).toBeNull();
    expect(checkPhotoUpload({ ...ok, size: MAX_PHOTO_BYTES + 1 })).toBe(PHOTO_TOO_BIG_ERROR);
  });

  it("REQ-039.3 con permiso e imagen válida pasa, también en JPEG (Safari)", () => {
    expect(checkPhotoUpload(ok)).toBeNull();
    expect(checkPhotoUpload({ ...ok, type: "image/jpeg" })).toBeNull();
  });

  it("REQ-039.1 la ruta es la que admiten las políticas de Storage", () => {
    expect(newBarberPhotoPath(BIZ, BARBER)).toMatch(
      new RegExp(`^${BIZ}/barbers/${BARBER}/[0-9a-f-]{36}\\.webp$`),
    );
  });
});
