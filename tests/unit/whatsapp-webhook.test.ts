import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  autoReplyText,
  normalizeOptOut,
  parseWebhookEvents,
  verifySignature,
} from "@/lib/domain/whatsapp-webhook";

const sign = (body: string, secret = "secreto") =>
  `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

describe("normalizeOptOut", () => {
  it.each(["parar", "PARAR ", "párar", "  PÁRAR\n", "pa rar", "Parar"])(
    "REQ-042.2 %j es PARAR",
    (text) => {
      expect(normalizeOptOut(text)).toBe("PARAR");
    },
  );

  it.each(["hola", "parar ya", "no parar", ""])("REQ-042.4 %j no es PARAR", (text) => {
    expect(normalizeOptOut(text)).not.toBe("PARAR");
  });
});

describe("verifySignature", () => {
  const body = '{"entry":[{"id":"1"}]}';

  it("REQ-043.5 acepta la firma del cuerpo crudo", () => {
    expect(verifySignature(body, sign(body), "secreto")).toBe(true);
  });

  it("REQ-043.5 acepta tildes: la firma es sobre los bytes", () => {
    const accented = '{"text":"párar"}';
    expect(verifySignature(accented, sign(accented), "secreto")).toBe(true);
  });

  it("REQ-043.5 rechaza un cuerpo cambiado", () => {
    expect(verifySignature(`${body} `, sign(body), "secreto")).toBe(false);
  });

  it("REQ-043.5 rechaza otro secreto", () => {
    expect(verifySignature(body, sign(body, "otro"), "secreto")).toBe(false);
  });

  it.each([null, "", "sha256=", "sha256=zz", "md5=abc", sign("x").slice(0, 20)])(
    "REQ-043.5 rechaza la cabecera %j sin lanzar",
    (header) => {
      expect(verifySignature(body, header, "secreto")).toBe(false);
    },
  );

  it("REQ-043.5 rechaza si el servidor no tiene secreto", () => {
    expect(verifySignature(body, sign(body, ""), "")).toBe(false);
  });
});

describe("parseWebhookEvents", () => {
  const payload = (value: unknown) => ({ entry: [{ changes: [{ field: "messages", value }] }] });

  it("REQ-040.7 lee estados con su código de error", () => {
    const events = parseWebhookEvents(
      payload({
        statuses: [
          { id: "wamid.1", status: "sent" },
          { id: "wamid.2", status: "failed", errors: [{ code: 131026 }] },
        ],
      }),
    );

    expect(events).toEqual([
      { type: "status", messageId: "wamid.1", status: "sent", errorCode: null },
      { type: "status", messageId: "wamid.2", status: "failed", errorCode: "131026" },
    ]);
  });

  it("REQ-040.7 ignora el estado `read`, que no cambia el aviso", () => {
    expect(parseWebhookEvents(payload({ statuses: [{ id: "wamid.1", status: "read" }] }))).toEqual(
      [],
    );
  });

  it("REQ-042.2 lee el celular y el texto de un mensaje", () => {
    expect(
      parseWebhookEvents(
        payload({ messages: [{ from: "573001234567", type: "text", text: { body: "parar" } }] }),
      ),
    ).toEqual([{ type: "message", phoneE164: "+573001234567", text: "parar" }]);
  });

  it("REQ-042.4 un mensaje sin texto, como un audio, también es un mensaje", () => {
    expect(
      parseWebhookEvents(payload({ messages: [{ from: "573001234567", type: "audio" }] })),
    ).toEqual([{ type: "message", phoneE164: "+573001234567", text: "" }]);
  });

  it("REQ-042.4 un número no colombiano no tiene ficha: se ignora", () => {
    expect(
      parseWebhookEvents(
        payload({ messages: [{ from: "14155551234", type: "text", text: { body: "hola" } }] }),
      ),
    ).toEqual([]);
  });

  it.each([null, "texto", {}, { entry: "x" }, { entry: [{ changes: [{}] }] }])(
    "REQ-043.5 un cuerpo sin la forma esperada no da eventos: %j",
    (body) => {
      expect(parseWebhookEvents(body)).toEqual([]);
    },
  );
});

describe("autoReplyText", () => {
  it("REQ-042.4 da el número de la barbería", () => {
    expect(autoReplyText("+573001234567")).toBe(
      "Este número solo envía avisos. Para hablar con la barbería escribe al 300 123 4567",
    );
  });

  it("REQ-042.5 sin número omite esa parte", () => {
    expect(autoReplyText(null)).toBe("Este número solo envía avisos.");
  });
});
