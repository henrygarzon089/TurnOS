import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/** REQ-075 forma de "Mi agenda" mientras llega: título, rótulo del día y filas de 56 px. */
export default function MyAgendaLoading() {
  return (
    <SkeletonScreen className="flex flex-col pb-6">
      <SkeletonBlock className="mt-4 h-7 w-32" />
      <SkeletonBlock className="mt-5 h-4 w-20" />
      <div className="mt-2 space-y-1">
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
      </div>
    </SkeletonScreen>
  );
}
