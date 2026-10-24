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
