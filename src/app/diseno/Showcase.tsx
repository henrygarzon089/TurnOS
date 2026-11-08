"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { Field } from "@/components/ui/Field";
import { FlashRow } from "@/components/ui/FlashRow";
import { MoneyField } from "@/components/ui/MoneyField";
import { OptionList } from "@/components/ui/OptionList";
import { PhoneField } from "@/components/ui/PhoneField";
import { PinField } from "@/components/ui/PinField";
import { Dialog, Sheet } from "@/components/ui/Sheet";
import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { Toast } from "@/components/ui/Toast";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line flex flex-col gap-4 border-t py-6">
      <h2 className="text-ink text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const [saves, setSaves] = useState(0);
  const [voided, setVoided] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [phone, setPhone] = useState("300 100 0001");
  const [money, setMoney] = useState<number | null>(25000);
  const [pin, setPin] = useState("");
  const [service, setService] = useState("corte");
  const [pay, setPay] = useState("nequi");
  const [toast, setToast] = useState(true);
  const [flashKey, setFlashKey] = useState(0);
  const closeSheet = useCallback(() => setSheet(false), []);
  const closeDialog = useCallback(() => setDialog(false), []);
  const closeToast = useCallback(() => setToast(false), []);

  return (
    <main className="bg-surface text-ink mx-auto min-h-dvh max-w-3xl px-4 pb-24">
      <h1 className="pt-8 text-3xl font-bold">Componentes y estados</h1>
      <p className="text-muted mt-1">
        Muestra de desarrollo (T-161). Compárala con docs/diseno/tableros/Componentes.png.
      </p>

      <Section title="Botones">
        <div className="flex flex-wrap gap-3">
          <Button>Tomar turno</Button>
          <Button disabled>Tomar turno</Button>
          <Button pending>Tomar turno</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Reservar cita</Button>
          <Button variant="secondary" disabled>
            Reservar cita
          </Button>
          <Button variant="danger" onClick={() => setSheet(true)}>
            Anular venta
          </Button>
          <Button variant="danger" pending pendingText="Cancelando…">
            Cancelar turno
          </Button>
          <Button variant="text">Ver menú del local</Button>
        </div>
        <Button size="giant">Llamar a A14</Button>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            data-testid="save-test"
            onAction={async () => {
              await wait(800);
              setSaves((n) => n + 1);
            }}
          >
            Guardar prueba
          </Button>
          <span data-testid="saves" className="text-muted">
            {saves} {saves === 1 ? "guardado" : "guardados"}
          </span>
        </div>
      </Section>

      <Section title="Campos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tu nombre" defaultValue="Juan Pérez" hint="Normal" />
          <Field label="Tu nombre" defaultValue="" error="Escribe tu nombre" />
          <Field label="Tu nombre" defaultValue="Juan Pérez" disabled />
          <PhoneField label="Celular" value={phone} onChange={setPhone} hint="3XX XXX XXXX" />
          <MoneyField label="Valor" value={money} onChange={setMoney} hint="Pesos, sin decimales" />
          <PinField
            label="PIN de prueba"
            value={pin}
            onChange={setPin}
            hint="Nunca se ven los dígitos"
          />
          <PinField
            label="PIN con error"
            value="123456"
            onChange={() => {}}
            error="Ese PIN no es. Te quedan 2 intentos."
          />
        </div>
      </Section>

      <Section title="Selectores">
        <OptionList
          name="servicio"
          legend="Servicio"
          value={service}
          onChange={setService}
          options={[
            { value: "corte", label: "Corte", meta: "30 min", aside: "$ 25.000" },
            { value: "barba", label: "Corte + barba", meta: "45 min", aside: "$ 35.000" },
            {
              value: "cejas",
              label: "Cejas",
              meta: "No lo hace el barbero elegido",
              aside: "$ 8.000",
              disabled: true,
            },
          ]}
        />
        <OptionList
          name="medio"
          legend="Medio de pago"
          layout="grid"
          value={pay}
          onChange={setPay}
          options={["Efectivo", "Nequi", "Daviplata", "Transf.", "Tarjeta", "Dividido"].map(
            (l) => ({
              value: l.toLowerCase(),
              label: l,
            }),
          )}
        />
      </Section>

      <Section title="Estado del turno">
        <div className="flex flex-wrap gap-2">
          <StatusChip status="waiting" />
          <StatusChip status="called" />
          <StatusChip status="in_service" />
          <StatusChip status="done" />
          <StatusChip status="cancelled" />
          <StatusChip status="no_show" />
          <StatusChip status="appointment" time="3:30 p. m." />
        </div>
      </Section>

      <Section title="Tiempo real">
        <div className="bg-card border-line rounded-md border">
          <div className="border-line flex h-14 items-center gap-3 border-b px-4">
            <b className="w-12">A14</b> Juan P.
          </div>
          <FlashRow
            key={flashKey}
            flash={flashKey > 0}
            className="flex h-14 items-center gap-3 px-4"
          >
            <b className="w-12">A20</b> Dani C.
          </FlashRow>
        </div>
        <Button variant="text" onClick={() => setFlashKey((k) => k + 1)}>
          Simular turno nuevo
        </Button>
      </Section>

      <Section title="Avisos">
        {toast && (
          <Toast onClose={closeToast} action={{ label: "Deshacer", onClick: closeToast }}>
            Venta guardada · $ 25.000
          </Toast>
        )}
        <Toast tone="error" onClose={() => {}}>
          <b>No se guardó.</b> Revisa la señal e intenta de nuevo.
        </Toast>
        <div className="border-line overflow-hidden rounded-md border">
          <ConnectionBanner online={false} lastSeen={new Date("2026-11-07T20:40:00Z")} />
        </div>
      </Section>

      <Section title="Esqueleto, vacío, error">
        <SkeletonScreen className="bg-card border-line flex flex-col gap-3 rounded-md border p-4">
          <SkeletonBlock className="h-6 w-2/3" />
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
        </SkeletonScreen>
        <div className="bg-card border-line rounded-md border">
          <EmptyState
            title="Todavía no hay turnos"
            text="Comparte el QR del local para que la gente tome turno."
            action={<Button variant="secondary">Ver QR</Button>}
          />
        </div>
        <div className="bg-card border-line rounded-md border">
          <ErrorState title="No pudimos cargar la fila" dataSafe onRetry={() => {}} />
        </div>
      </Section>

      <Section title="Hoja y diálogo">
        <p data-testid="voided" className="text-muted">
          {voided ? "Venta anulada" : "Sin anular"}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Reabrir caja
          </Button>
        </div>
      </Section>

      <Sheet
        open={sheet}
        onClose={closeSheet}
        title="¿Anular esta venta?"
        description="Corte · Andrés · $ 25.000. Queda en el registro como anulada y sale de la caja de hoy."
      >
        <Field label="Motivo" placeholder="Se cobró dos veces" />
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            setVoided(true);
            setSheet(false);
          }}
        >
          Sí, anular venta
        </Button>
        <Button variant="text" className="mx-auto" onClick={closeSheet}>
          No, volver
        </Button>
      </Sheet>

      <Dialog
        open={dialog}
        onClose={closeDialog}
        title="Reabrir el cierre del 5 de noviembre"
        description="Solo tú puedes reabrir un cierre. Queda anotado quién y por qué."
      >
        <Field label="Motivo (obligatorio)" placeholder="Faltó registrar una venta de Nequi" />
        <div className="flex justify-end gap-3">
          <Button variant="text" onClick={closeDialog}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={closeDialog}>
            Reabrir caja
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
