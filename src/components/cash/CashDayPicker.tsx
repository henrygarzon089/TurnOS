"use client";

import { useRouter } from "next/navigation";
import { cashDayLabel } from "@/lib/domain/cash-sales";

/**
 * REQ-078.31 la fecha junto al título de la caja ("jue 6 nov. ▾"): lleva a la caja de ese día. El
 * texto es nuestro; el calendario es el del celular (un `input type=date` invisible encima, para
 * que no se vea texto propio del navegador, REQ-078.20).
 */
export function CashDayPicker({ day, today }: { day: string; today: string }) {
  const router = useRouter();
  return (
    <label className="border-line-strong bg-card text-ink relative inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-3 text-base">
      {cashDayLabel(day)}
      <span aria-hidden="true" className="text-sm">
        ▾
      </span>
      <input
        type="date"
        aria-label="Ver la caja de otro día"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={day}
        max={today}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // navegadores sin showPicker abren el calendario solos
          }
        }}
        onChange={(e) => {
          const v = e.target.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v === day) return;
          router.push(v >= today ? "/admin/caja" : `/admin/caja/${v}`);
        }}
      />
    </label>
  );
}
