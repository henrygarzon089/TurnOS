import { TodayCardSkeleton } from "@/components/admin/today/TodayCard";
import { SkeletonBlock } from "@/components/ui/Skeleton";

/** Forma de "Hoy" mientras llega la página (REQ-076.10, design §21.1). */
export default function TodayLoading() {
  return (
    <main data-wide className="pb-6">
      <SkeletonBlock className="h-9 w-48" />
      <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8">
          <TodayCardSkeleton rows={5} />
        </div>
        <div className="lg:col-span-4">
          <TodayCardSkeleton rows={6} />
        </div>
      </div>
    </main>
  );
}
