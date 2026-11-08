import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";

/** REQ-075.1: forma de la página del QR mientras llegan los datos del negocio. */
export default function BusinessLoading() {
  return (
    <SkeletonScreen className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28">
      <div className="py-6">
        <SkeletonBlock className="h-9 w-3/4" />
        <SkeletonBlock className="mt-2 h-4 w-1/2" />
      </div>
      <SkeletonBlock className="h-36 w-full rounded-md" />
      <div className="mt-5 space-y-3">
        <SkeletonBlock className="h-4 w-1/3" />
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
