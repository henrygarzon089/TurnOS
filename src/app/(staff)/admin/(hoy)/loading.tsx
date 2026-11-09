import { TodayCardSkeleton } from "@/components/admin/today/TodayCard";
import { SkeletonBlock } from "@/components/ui/Skeleton";

/** Forma de "Hoy" mientras llega la página (REQ-076.10, design §21.1). */
export default function TodayLoading() {
  return (
    <main className="pb-6">
      <SkeletonBlock className="h-9 w-48" />
      <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
          <TodayCardSkeleton rows={3} />
        </div>
        <div className="lg:col-span-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <TodayCardSkeleton rows={5} />
        </div>
        <div className="lg:col-span-4 lg:row-start-3">
          <TodayCardSkeleton rows={6} />
        </div>
      </div>
    </main>
  );
}
