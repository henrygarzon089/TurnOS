import {
  getBirthdaysThisWeek,
  getInactiveCustomers,
  type BirthdaysView,
  type RemindersView,
} from "@/lib/actions/customers";
import { buildRemindPeople } from "@/lib/domain/today";
import { buildBirthdayLink, buildReminderLink } from "@/lib/notifications/reminder";
import { RemindWriteLink } from "./RemindWriteLink";
import { TodayBlockError } from "./TodayBlockError";
import { TodayCard } from "./TodayCard";

type Data = { birthdays: BirthdaysView; inactive: RemindersView };

async function loadTodayRemind(): Promise<Data | null> {
  const [birthdays, inactive] = await Promise.all([getBirthdaysThisWeek(), getInactiveCustomers()]);
  if (!birthdays || !inactive) return null;
  return { birthdays, inactive };
}

/**
 * REQ-076.7, REQ-078.28 "Para recordar" como el tablero: hasta 4 personas (2 en el celular) con
 * CUMPLE o NO VUELVE, cuándo, y "Escribirle" con el mensaje de Recordar (REQ-037, REQ-020). El
 * celular va solo dentro del enlace de WhatsApp, nunca en el texto.
 */
export async function TodayRemind({
  load = loadTodayRemind,
}: { load?: () => Promise<Data | null> } = {}) {
  let data: Data | null = null;
  try {
    data = await load();
  } catch {
    data = null;
  }
  if (!data) {
    return (
      <TodayCard title="Para recordar" link={{ href: "/admin/recordar", label: "Ver todos" }}>
        <TodayBlockError />
      </TodayCard>
    );
  }
  const { birthdays, inactive } = data;
  const phones = new Map(
    [...birthdays.customers, ...inactive.customers].map((c) => [c.id, c.phone]),
  );
  const people = buildRemindPeople(birthdays.customers, inactive.customers, birthdays.today);
  return (
    <TodayCard title="Para recordar" link={{ href: "/admin/recordar", label: "Ver todos" }}>
      {people.length === 0 ? (
        <p className="text-muted px-4 py-4">Nadie para recordar esta semana.</p>
      ) : (
        <ul>
          {people.map((p, i) => {
            const phoneE164 = phones.get(p.id) ?? "";
            const href =
              p.kind === "birthday"
                ? buildBirthdayLink({
                    phoneE164,
                    template: birthdays.template,
                    customerName: p.name,
                    businessName: birthdays.businessName,
                  })
                : buildReminderLink({
                    phoneE164,
                    template: inactive.template,
                    customerName: p.name,
                    businessName: inactive.businessName,
                    queueUrl: inactive.queueUrl,
                  });
            return (
              <li
                key={`${p.kind}-${p.id}`}
                className={`border-line flex min-h-12 items-center gap-3 border-t px-4 first:border-t-0 ${i >= 2 ? "max-lg:hidden" : ""}`}
              >
                <span className="text-muted hidden w-28 shrink-0 text-xs font-bold tracking-wider lg:inline">
                  {p.kind === "birthday" ? "CUMPLE" : "NO VUELVE"}
                </span>
                <p className="min-w-0 flex-1 truncate">
                  <b>{p.name}</b>
                  {p.kind === "birthday" ? (
                    <>
                      <span className="lg:hidden"> cumple {p.when}</span>
                      <span className="max-lg:hidden"> · {p.when}</span>
                    </>
                  ) : (
                    ` · ${p.when}`
                  )}
                </p>
                <RemindWriteLink
                  href={href}
                  customerId={p.kind === "inactive" ? p.id : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
    </TodayCard>
  );
}
