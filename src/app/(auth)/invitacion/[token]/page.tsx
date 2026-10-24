import type { Metadata } from "next";
import { AcceptInvitationForm } from "@/components/auth/AcceptInvitationForm";
import { getInvitation } from "@/lib/actions/public";

export const metadata: Metadata = { title: "Invitación" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getInvitation(token);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
      {!info || !info.isValid ? (
        <>
          <h1 className="text-2xl font-bold">Invitación no válida</h1>
          <p className="text-muted mt-2">
            Este enlace ya se usó o venció (dura 7 días). Pídele al dueño que te envíe uno nuevo.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Hola, {info.barberName}</h1>
          <p className="text-muted mt-2">
            <strong>{info.businessName}</strong> te invitó a TurnOS. Elige un PIN de 6 números: con
            tu celular y ese PIN entrarás a tu fila.
          </p>
          <AcceptInvitationForm token={token} />
        </>
      )}
    </main>
  );
}
