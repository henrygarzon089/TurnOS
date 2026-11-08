"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/States";

/** Error de una página del dueño con "Intentar de nuevo" que vuelve a pedir los datos (REQ-078.11). */
export function RetryError({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div className="border-line bg-card mt-4 rounded-md border">
      <ErrorState title={title} dataSafe onRetry={() => router.refresh()} />
    </div>
  );
}
