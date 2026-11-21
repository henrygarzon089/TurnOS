import { describe, expect, it } from "vitest";
import {
  applicantWhatsappLink,
  hiringWhatsappLink,
  jobPostingJsonLd,
  parseJobApplication,
  portfolioUrl,
  receivedLabel,
  type JobApplicationInput,
} from "@/lib/domain/jobs";

const base: JobApplicationInput = {
  name: "  Camilo   Ruiz ",
  phone: "300 123 4567",
  phoneCountry: "co",
  role: "barbero",
  years: "3",
  portfolio: "@camilo.cuts",
  availability: "tiempo_completo",
  message: "",
  privacyAccepted: true,
  website: "",
};

describe("REQ-102 postulación", () => {
  it("REQ-102.3 datos válidos salen normalizados", () => {
    const r = parseJobApplication(base);
    expect(r).toEqual({
      ok: true,
      data: {
        name: "Camilo Ruiz",
        phoneE164: "+573001234567",
        role: "barbero",
        years: 3,
        portfolioUrl: "https://instagram.com/camilo.cuts",
        availability: "tiempo_completo",
        message: null,
      },
    });
  });

  it("REQ-102.3 acepta celular de otro país", () => {
    const r = parseJobApplication({ ...base, phone: "+54 9 11 5555 0001", phoneCountry: "other" });
    expect(r.ok && r.data.phoneE164).toBe("+5491155550001");
  });

  it("REQ-102.4 cada dato inválido tiene su mensaje claro", () => {
    const r = parseJobApplication({
      ...base,
      name: "C",
      phone: "123",
      role: "chef",
      years: "x",
      portfolio: "javascript:alert(1)",
      availability: "",
      message: "a".repeat(501),
      privacyAccepted: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual(
        ["availability", "message", "name", "phone", "portfolio", "privacy", "role", "years"].sort(),
      );
  });

  it("REQ-102.3 sin autorización de datos no se envía", () => {
    const r = parseJobApplication({ ...base, privacyAccepted: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.privacy).toMatch(/aviso de privacidad/);
  });

  it("REQ-102.5 el campo trampa lleno es un robot", () => {
    expect(parseJobApplication({ ...base, website: "http://spam" })).toEqual({
      ok: false,
      spam: true,
      errors: {},
    });
  });

  it("REQ-102.3 enlace del trabajo: https, Instagram o vacío", () => {
    expect(portfolioUrl("")).toBeNull();
    expect(portfolioUrl("https://tiktok.com/@c")).toBe("https://tiktok.com/@c");
    expect(portfolioUrl("www.instagram.com/c")).toBe("https://instagram.com/c");
    expect(portfolioUrl("http://x.com")).toBeUndefined();
    expect(portfolioUrl("https://x.com/" + "a".repeat(200))).toBeUndefined();
  });

  it("REQ-102.2 WhatsApp de la página y REQ-102.6 WhatsApp del dueño con mensaje listo", () => {
    expect(hiringWhatsappLink("+573207145752", "Gamma Club")).toBe(
      "https://wa.me/573207145752?text=" +
        encodeURIComponent("Hola, vi el aviso de Gamma Club y quiero trabajar con ustedes."),
    );
    expect(applicantWhatsappLink("+573001234567", "Camilo Ruiz", "Gamma Club")).toContain(
      encodeURIComponent("Hola Camilo, te escribimos de Gamma Club"),
    );
  });

  it("REQ-102.8 JobPosting sin salario", () => {
    const ld = jobPostingJsonLd({
      businessName: "Gamma Club",
      url: "https://www.gammaclub.co/trabaja-con-nosotros",
      siteUrl: "https://www.gammaclub.co",
      address: "Cl. 78 Sur",
      datePosted: "2026-11-20",
      description: "Buscamos barberos y estilistas",
    });
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.jobLocation.address.addressLocality).toBe("Sabaneta");
    expect(JSON.stringify(ld)).not.toMatch(/baseSalary|salary/);
  });

  it("REQ-102.6 cuándo llegó", () => {
    const now = new Date("2026-11-20T15:00:00Z");
    expect(receivedLabel("2026-11-20T10:00:00Z", now)).toBe("Hoy");
    expect(receivedLabel("2026-11-19T10:00:00Z", now)).toBe("Ayer");
    expect(receivedLabel("2026-11-15T10:00:00Z", now)).toBe("Hace 5 días");
  });
});
