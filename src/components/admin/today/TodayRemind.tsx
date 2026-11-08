import { getBirthdaysThisWeek, getInactiveCustomers } from "@/lib/actions/customers";
import { TodayBlockError } from "./TodayBlockError";
import { TodayCard } from "./TodayCard";

type Data = { birthdays: number; inactive: number; inactiveDays: number };

async function loadTodayRemind(): Promise<Data | null> {
  const [birthdays, inactive] = await Promise.all([getBirthdaysThisWeek(), getInactiveCustomers()]);
  if (!birthdays || !inactive) return null;
  return {
    birthdays: birthdays.customers.length,
    inactive: inactive.customers.length,
    inactiveDays: inactive.inactiveDays,
  };
}

/** REQ-076.7 solo los conteos (REQ-037, REQ-020), con enlace a "Recordar"; nunca celulares. */
export async function TodayRemind({
  load = loadTodayRemind,
}: { load?: () => Promise<Data | null> } = {}) {
  let data: Data | null = null;
  try {
    data = await load();
  } catch {
    data = null;
  }
  return (
    <TodayCard title="Para recordar" link={{ href: "/admin/recordar", label: "Recordar" }}>
      {!data ? (
        <TodayBlockError />
      ) : (
        <dl>
          <div className="flex min-h-12 items-center justify-between gap-3 px-4">
            <dt>{data.birthdays === 1 ? "Cumple años esta semana" : "Cumplen años esta semana"}</dt>
            <dd className="font-bold tabular-nums">{data.birthdays}</dd>
          </div>
          <div className="border-line flex min-h-12 items-center justify-between gap-3 border-t px-4">
            <dt>
              {data.inactive === 1 ? "Hace rato no viene" : "Hace rato no vienen"}{" "}
              <span className="text-muted text-sm">(más de {data.inactiveDays} días)</span>
            </dt>
            <dd className="font-bold tabular-nums">{data.inactive}</dd>
          </div>
        </dl>
      )}
    </TodayCard>
  );
}
