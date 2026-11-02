import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getKnowledgeDoc } from "@/backend/data/knowledge";
import { KnowledgeDocPage } from "@/frontend/components/knowledge/knowledge-doc";
import { Skeleton } from "@/frontend/components/ui/feedback";

export const instant = false;

export async function generateMetadata(props: PageProps<"/knowledge/[id]">) {
  const { id } = await props.params;
  const session = await requireSession();
  const doc = await getKnowledgeDoc(id, session.workspace.id);
  return { title: doc?.title ?? "Knowledge" };
}

/**
 * The Suspense boundary is not only for the first paint. A save calls
 * `refresh()`, which re-runs this segment; without a boundary of its own the
 * re-suspend reaches the layout's, and React tears down the editor — taking
 * the caret, the draft and any upload in flight with it.
 */
export default function KnowledgeDocRoute(props: PageProps<"/knowledge/[id]">) {
  return (
    <Suspense fallback={<DocSkeleton />}>
      <DocData {...props} />
    </Suspense>
  );
}

async function DocData(props: PageProps<"/knowledge/[id]">) {
  await connection();

  const { id } = await props.params;
  const session = await requireSession();

  const doc = await getKnowledgeDoc(id, session.workspace.id);
  if (!doc) notFound();

  // Keyed by id so moving between pages remounts with a fresh draft, rather
  // than carrying the previous page's unsaved text onto this one.
  return <KnowledgeDocPage key={doc.id} doc={doc} />;
}

function DocSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[52rem] space-y-3 px-3 py-4 sm:px-4 lg:px-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-80" />
      <Skeleton className="h-3 w-56" />
      <div className="space-y-2 pt-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}
