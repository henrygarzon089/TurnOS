import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/** REQ-075.1: forma de "Mi turno" mientras llega el turno (saludo, número grande, estado). */
export default function TicketLoading() {
  return (
    <SkeletonScreen className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-5 pb-28">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="mt-2 h-8 w-2/3" />
      <SkeletonBlock className="mt-3 h-4 w-12" />
      <SkeletonBlock className="mt-1 h-24 w-32 rounded-md" />
      <SkeletonBlock className="mt-4 h-44 w-full rounded-md" />
      <div className="mt-5 space-y-3">
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-10 w-full" />
      </div>
      <div className="border-line bg-card fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <SkeletonBlock className="h-12 w-full rounded-md" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
