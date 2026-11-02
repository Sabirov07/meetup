import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getTranslator } from "@/backend/i18n/locale";
import { listKnowledgeDocs } from "@/backend/data/knowledge";
import { KnowledgeLibrary } from "@/frontend/components/knowledge/knowledge-library";
import { Skeleton } from "@/frontend/components/ui/feedback";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.knowledge") };
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <LibraryData />
    </Suspense>
  );
}

async function LibraryData() {
  await connection();
  const session = await requireSession();
  const docs = await listKnowledgeDocs(session.workspace.id);

  return <KnowledgeLibrary docs={docs} />;
}

function LibrarySkeleton() {
  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-96" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-8 w-full" />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
