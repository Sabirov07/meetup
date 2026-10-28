import { Skeleton, TaskRowSkeleton } from "@/components/ui/feedback";

/** Matches the kanban geometry so nothing jumps when data arrives. */
export function BoardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3 w-80" />
          <Skeleton className="h-2.5 w-40" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {[4, 3, 2, 3].map((rows, column) => (
          <div
            key={column}
            className="overflow-hidden rounded-xl border border-line bg-surface"
          >
            <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: rows }, (_, i) => (
              <TaskRowSkeleton key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
