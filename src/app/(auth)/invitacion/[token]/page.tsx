import type { Metadata } from "next";
import { AcceptInvitationForm } from "@/components/auth/AcceptInvitationForm";
import { AuthCard } from "@/components/auth/AuthCard";
import { getInvitation } from "@/lib/actions/public";

export const metadata: Metadata = { title: "Invitación" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getInvitation(token);

  if (!info || !info.isValid) {
    return (
      <AuthCard
        title="Invitación no válida"
        subtitle="Este enlace ya se usó o venció (dura 7 días). Pídele al dueño que te envíe uno nuevo."
      >
        {null}
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={`Hola, ${info.barberName}`}
      subtitle={
        <>
          <strong className="text-ink">{info.businessName}</strong> te invitó a TurnOS. Elige un PIN
          de 6 números: con tu celular y ese PIN entrarás a tu fila.
        </>
      }
    >
      <AcceptInvitationForm token={token} />
    </AuthCard>
  );
}
