import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/** T-221 · foto del barbero (REQ-085.1…085.4, REQ-090.2, design.md §26.2). */
const m = vi.hoisted(() => ({
  session: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  current: { photo_path: null as string | null },
  updateError: null as null | { message: string },
  updates: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getStaffSession: m.session }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    const chain = {
      select: () => chain,
      update: (v: unknown) => {
        m.updates.push(v);
        const done = () => Promise.resolve({ error: m.updateError });
        const step = { eq: () => step, then: (f: (r: unknown) => unknown) => done().then(f) };
        return step;
      },
      eq: () => chain,
      maybeSingle: async () => ({ data: m.current }),
    };
    return {
      from: () => chain,
      storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
    };
  },
}));

import { removeBrandImage, uploadBrandImage } from "@/lib/actions/brand";
import { Avatar } from "@/components/media/Avatar";
import {
  BRAND_FORBIDDEN,
  BRAND_SIZES,
  canEditBrand,
  checkPickedFile,
  MAX_PICKED_BYTES,
  newBrandPath,
  PICK_ERROR,
} from "@/lib/media/brand";
import { coverCrop } from "@/lib/media/resize";

const BIZ = "11111111-1111-4111-8111-111111111111";
const JUAN = "22222222-2222-4222-8222-222222222222";
const PEDRO = "33333333-3333-4333-8333-333333333333";
const owner = { role: "owner", barberId: null, business: { id: BIZ } };
const juan = { role: "barber", barberId: JUAN, business: { id: BIZ } };

function form(kind: string, id: string | null, size = 1000) {
  const f = new FormData();
  f.set("kind", kind);
  if (id) f.set("id", id);
  f.set("photo", new Blob([new Uint8Array(size)], { type: "image/webp" }), "foto.webp");
  return f;
}

beforeEach(() => {
  m.session.mockReset();
  m.upload.mockReset().mockResolvedValue({ error: null });
  m.remove.mockReset().mockResolvedValue({ error: null });
  m.current = { photo_path: null };
  m.updateError = null;
  m.updates = [];
});

describe("REQ-085 foto del barbero", () => {
  it("REQ-085.1 el dueño cambia la foto de cualquier barbero", () => {
    expect(canEditBrand(owner, "barber", PEDRO)).toBe(true);
    expect(canEditBrand(owner, "service", PEDRO)).toBe(true);
  });

  it("REQ-085.2 el barbero cambia solo su propia foto", () => {
    expect(canEditBrand(juan, "barber", JUAN)).toBe(true);
    expect(canEditBrand(juan, "barber", PEDRO)).toBe(false);
    expect(canEditBrand(juan, "logo", null)).toBe(false);
  });

  it("REQ-085.3 se escoge una foto de hasta 10 MB y queda de 400 × 400", () => {
    expect(checkPickedFile({ type: "image/heic", size: MAX_PICKED_BYTES })).toBeNull();
    expect(checkPickedFile({ type: "image/jpeg", size: MAX_PICKED_BYTES + 1 })).toBe(PICK_ERROR);
    expect(checkPickedFile({ type: "application/pdf", size: 10 })).toBe(PICK_ERROR);
    expect(PICK_ERROR).toBe("Sube una foto de hasta 10 MB.");
    expect(BRAND_SIZES.barber).toEqual({ width: 400, height: 400 });
  });

  it("REQ-085.3 el recorte llena el cuadro desde el centro sin deformar", () => {
    expect(coverCrop(1200, 800, 400, 400)).toEqual({ sx: 200, sy: 0, sw: 800, sh: 800 });
    expect(coverCrop(800, 1200, 400, 400)).toEqual({ sx: 0, sy: 200, sw: 800, sh: 800 });
    expect(coverCrop(1200, 600, 1200, 600)).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 600 });
  });

  it("REQ-085.4 sin foto se muestran las iniciales", () => {
    const html = renderToStaticMarkup(<Avatar name="Juan Pérez" photoPath={null} />);
    expect(html).toMatch(/data-testid="avatar-initials"[^>]*>JP</);
  });

  it("REQ-085.4 con foto se muestra la foto con su nombre", () => {
    const html = renderToStaticMarkup(
      <Avatar name="Juan" photoPath={`${BIZ}/barbers/${JUAN}/x.webp`} />,
    );
    expect(html).toContain('alt="Foto de Juan"');
    expect(html).not.toContain("avatar-initials");
  });

  it("REQ-085.1 la ruta es la que admiten 0074 y las políticas de Storage", () => {
    expect(newBrandPath("barber", BIZ, JUAN)).toMatch(
      new RegExp(`^${BIZ}/barbers/${JUAN}/[0-9a-f-]{36}\\.webp$`),
    );
    expect(newBrandPath("service", BIZ, null)).toMatch(
      new RegExp(`^${BIZ}/services/[0-9a-f-]{36}\\.webp$`),
    );
    expect(newBrandPath("cover", BIZ, null)).toMatch(new RegExp(`^${BIZ}/brand/`));
  });

  it("REQ-085.2 el barbero sube su foto y queda guardada", async () => {
    m.session.mockResolvedValue(juan);
    const r = await uploadBrandImage(form("barber", JUAN));
    expect(r.ok).toBe(true);
    expect(m.upload).toHaveBeenCalledTimes(1);
    expect(m.upload.mock.calls[0][0]).toMatch(new RegExp(`^${BIZ}/barbers/${JUAN}/`));
    expect(m.updates).toEqual([{ photo_path: (r as { path: string }).path }]);
  });
});

describe("REQ-090.2 permisos y archivos de las fotos", () => {
  it("REQ-090.2 el barbero no sube la foto de otro barbero", async () => {
    m.session.mockResolvedValue(juan);
    expect(await uploadBrandImage(form("barber", PEDRO))).toEqual({
      ok: false,
      error: BRAND_FORBIDDEN,
    });
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("REQ-090.2 sin sesión no se sube nada", async () => {
    m.session.mockResolvedValue(null);
    const r = await uploadBrandImage(form("barber", JUAN));
    expect(r.ok).toBe(false);
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("REQ-090.2 un archivo de más de 300 KB no llega a Storage", async () => {
    m.session.mockResolvedValue(owner);
    const r = await uploadBrandImage(form("barber", JUAN, 300 * 1024 + 1));
    expect(r).toEqual({ ok: false, error: PICK_ERROR });
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("REQ-090.2 al cambiar la foto se borra el archivo anterior", async () => {
    m.session.mockResolvedValue(owner);
    m.current = { photo_path: `${BIZ}/barbers/${JUAN}/vieja.webp` };
    const r = await uploadBrandImage(form("barber", JUAN));
    expect(r.ok).toBe(true);
    expect(m.remove).toHaveBeenCalledWith([`${BIZ}/barbers/${JUAN}/vieja.webp`]);
  });

  it("REQ-090.2 si no se pudo guardar, se borra el archivo recién subido", async () => {
    m.session.mockResolvedValue(owner);
    m.updateError = { message: "rls" };
    const r = await uploadBrandImage(form("barber", JUAN));
    expect(r.ok).toBe(false);
    const uploaded = m.upload.mock.calls[0][0];
    expect(m.remove).toHaveBeenCalledWith([uploaded]);
  });

  it("REQ-090.2 quitar la foto deja la ruta vacía y borra el archivo", async () => {
    m.session.mockResolvedValue(juan);
    m.current = { photo_path: `${BIZ}/barbers/${JUAN}/vieja.webp` };
    expect(await removeBrandImage("barber", JUAN)).toEqual({ ok: true, path: null });
    expect(m.updates).toEqual([{ photo_path: null }]);
    expect(m.remove).toHaveBeenCalledWith([`${BIZ}/barbers/${JUAN}/vieja.webp`]);
  });
});

describe("REQ-086 y REQ-087 fotos de servicios, logo y portada", () => {
  it("REQ-086.1 el dueño sube la foto de un servicio de 600 × 400", async () => {
    m.session.mockResolvedValue(owner);
    expect(BRAND_SIZES.service).toEqual({ width: 600, height: 400 });
    const r = await uploadBrandImage(form("service", PEDRO));
    expect(r.ok).toBe(true);
    expect(m.upload.mock.calls[0][0]).toMatch(new RegExp(`^${BIZ}/services/`));
  });

  it("REQ-086.1 el barbero no sube fotos de servicios", async () => {
    m.session.mockResolvedValue(juan);
    expect((await uploadBrandImage(form("service", PEDRO))).ok).toBe(false);
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("REQ-087.1 el dueño sube el logo (256 × 256) y la portada (1200 × 600)", async () => {
    m.session.mockResolvedValue(owner);
    expect(BRAND_SIZES.logo).toEqual({ width: 256, height: 256 });
    expect(BRAND_SIZES.cover).toEqual({ width: 1200, height: 600 });
    const logo = await uploadBrandImage(form("logo", null));
    const cover = await uploadBrandImage(form("cover", null));
    expect(logo.ok && cover.ok).toBe(true);
    expect(m.upload.mock.calls[0][0]).toMatch(new RegExp(`^${BIZ}/brand/`));
    expect(m.updates).toEqual([
      { logo_path: (logo as { path: string }).path },
      { cover_path: (cover as { path: string }).path },
    ]);
  });
});
