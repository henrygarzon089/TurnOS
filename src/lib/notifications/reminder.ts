import { giftCardDayLabel } from "@/lib/domain/giftCard";
import { renewalDayLabel } from "@/lib/domain/membership";
import { formatCOP } from "@/lib/domain/money";
import { getChannel } from "./channel";

/** REQ-020.3: enlace de WhatsApp del recordatorio con la plantilla editable (REQ-033). */
export function buildReminderLink(input: {
  phoneE164: string;
  template: string;
  customerName: string;
  businessName: string;
  queueUrl: string;
}): string {
  return (
    getChannel().buildLink({
      phoneE164: input.phoneE164,
      template: input.template,
      vars: {
        nombre: input.customerName.split(" ")[0],
        negocio: input.businessName,
        enlace: input.queueUrl,
      },
    }) ?? ""
  );
}

/** REQ-037.4: saludo de cumpleaños con la plantilla "cumpleaños" (REQ-033). */
export function buildBirthdayLink(input: {
  phoneE164: string;
  template: string;
  customerName: string;
  businessName: string;
}): string {
  return (
    getChannel().buildLink({
      phoneE164: input.phoneE164,
      template: input.template,
      vars: { nombre: input.customerName.split(" ")[0], negocio: input.businessName },
    }) ?? ""
  );
}

/** REQ-048.4: recordarle al titular que renueve, con la plantilla "Membresía por vencer" (REQ-033). */
export function buildRenewalLink(input: {
  phoneE164: string;
  template: string;
  customerName: string;
  businessName: string;
  endsOn: string;
}): string {
  return (
    getChannel().buildLink({
      phoneE164: input.phoneE164,
      template: input.template,
      vars: {
        nombre: input.customerName.split(" ")[0],
        negocio: input.businessName,
        fecha: renewalDayLabel(input.endsOn),
      },
    }) ?? ""
  );
}

/** REQ-056.1: enviar la tarjeta de regalo a quien la compró, con la plantilla "Tarjeta de regalo". */
export function buildGiftCardLink(input: {
  phoneE164: string;
  template: string;
  buyerName: string;
  businessName: string;
  amount: number;
  url: string;
  expiresOn: string;
}): string {
  return (
    getChannel().buildLink({
      phoneE164: input.phoneE164,
      template: input.template,
      vars: {
        nombre: input.buyerName.split(" ")[0],
        negocio: input.businessName,
        valor: formatCOP(input.amount),
        enlace: input.url,
        fecha: giftCardDayLabel(input.expiresOn),
      },
    }) ?? ""
  );
}
