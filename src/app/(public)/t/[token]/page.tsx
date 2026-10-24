import type { Metadata } from "next";
import { MyTicket } from "@/components/queue/MyTicket";
import { getTicketByToken } from "@/lib/actions/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi turno" };

/** REQ-004 / REQ-004.7 */
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const ticket = await getTicketByToken(token);

  if (!ticket) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 text-center">
        <h1 className="text-2xl font-bold">Este turno no existe o ya terminó</h1>
        <p className="text-muted mt-2">
          Si crees que es un error, vuelve a escanear el QR del local.
        </p>
      </main>
    );
  }

  return <MyTicket token={token} initial={ticket} alreadyHad={sp.ya === "1"} />;
}
