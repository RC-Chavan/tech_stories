import { StoryGridSkeleton } from "@/components/StoryGridSkeleton";

export default function Loading() {
  return (
    <div className="space-y-16">
      {/* Hero skeleton */}
      <section className="space-y-5">
        <div className="skeleton h-6 w-44" />
        <div className="skeleton h-14 w-3/4" />
        <div className="skeleton h-5 w-2/3" />
        <div className="flex gap-3 pt-2">
          <div className="skeleton h-10 w-44" />
          <div className="skeleton h-10 w-36" />
        </div>
      </section>

      {/* Grid skeleton */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-8 w-48" />
          </div>
          <div className="skeleton h-6 w-20" />
        </div>
        <StoryGridSkeleton count={6} />
      </section>
    </div>
  );
}
