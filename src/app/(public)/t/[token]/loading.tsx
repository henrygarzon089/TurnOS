import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/** REQ-075.1: forma de "Mi turno" mientras llega el turno. */
export default function TicketLoading() {
  return (
    <SkeletonScreen className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 pb-28">
      <SkeletonBlock className="h-8 w-2/3" />
      <SkeletonBlock className="mt-4 h-44 w-full rounded-md" />
      <div className="mt-5 space-y-3">
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-10 w-full" />
      </div>
      <div className="bg-surface fixed inset-x-0 bottom-0 p-4">
        <div className="mx-auto max-w-md">
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
