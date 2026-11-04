import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getTranslator } from "@/backend/i18n/locale";
import { listFlowcharts } from "@/backend/data/flowcharts";
import { FlowchartList } from "@/frontend/components/flowcharts/flowchart-list";
import { Skeleton } from "@/frontend/components/ui/feedback";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.flowcharts") };
}

export default function FlowchartsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ListData />
    </Suspense>
  );
}

async function ListData() {
  await connection();
  const session = await requireSession();
  const charts = await listFlowcharts(session.workspace.id);
  return <FlowchartList charts={charts} />;
}

function ListSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-96" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-8 w-full" />
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
