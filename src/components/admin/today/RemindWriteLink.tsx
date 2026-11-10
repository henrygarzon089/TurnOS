"use client";

import { logReminder } from "@/lib/actions/customers";

/**
 * "Escribirle" de "Para recordar" (REQ-078.28): abre WhatsApp como en Recordar. Al que no vuelve
 * se le anota el recordatorio (REQ-020.4), igual que "Recordar por WhatsApp".
 */
export function RemindWriteLink({ href, customerId }: { href: string; customerId?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={customerId ? () => void logReminder(customerId) : undefined}
      className="text-ink inline-flex min-h-12 shrink-0 items-center font-semibold underline underline-offset-4"
    >
      Escribirle
    </a>
  );
}
