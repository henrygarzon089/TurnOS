import { getAppointmentByToken } from "@/lib/actions/public-appointments";
import { appointmentIcs } from "@/lib/domain/appointments";

/** REQ-051.3: archivo de calendario de la cita. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getAppointmentByToken(token);
  if (!a) return new Response("Esta cita no existe", { status: 404 });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const ics = appointmentIcs({
    token,
    businessName: a.business.name,
    serviceName: a.serviceName,
    barberName: a.barberName,
    address: a.business.address,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    url: `${origin}/c/${token}`,
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="cita.ics"',
      "cache-control": "no-store",
    },
  });
}
