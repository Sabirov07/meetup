import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getFlowchart } from "@/backend/data/flowcharts";
import { FlowchartEditor } from "@/frontend/components/flowcharts/flowchart-editor";
import { Skeleton } from "@/frontend/components/ui/feedback";

export const instant = false;

export async function generateMetadata(props: PageProps<"/flowcharts/[id]">) {
  const { id } = await props.params;
  const session = await requireSession();
  const chart = await getFlowchart(id, session.workspace.id);
  return { title: chart?.title ?? "Flowchart" };
}

/** Its own Suspense boundary, for the same reason a knowledge page has one:
 *  a metadata save calls `refresh()`, and the canvas must survive it. */
export default function FlowchartRoute(props: PageProps<"/flowcharts/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorData {...props} />
    </Suspense>
  );
}

async function EditorData(props: PageProps<"/flowcharts/[id]">) {
  await connection();
  const { id } = await props.params;
  const session = await requireSession();
  const chart = await getFlowchart(id, session.workspace.id);
  if (!chart) notFound();
  return <FlowchartEditor key={chart.id} chart={chart} />;
}

function EditorSkeleton() {
  return (
    <div className="space-y-3 px-3 py-4 sm:px-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-80" />
      <Skeleton className="h-[60vh] w-full" />
    </div>
  );
}
