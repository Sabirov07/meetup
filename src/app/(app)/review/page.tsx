import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/backend/auth/guards";
import { getTranslator } from "@/backend/i18n/locale";
import { listAnalyses } from "@/backend/data/meetings";
import { isAiConfigured } from "@/backend/ai/extract";
import { ReviewView } from "@/frontend/components/review/review-view";
import { Skeleton } from "@/frontend/components/ui/feedback";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.review") };
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ReviewData />
    </Suspense>
  );
}

async function ReviewData() {
  await connection();
  const now = new Date();
  const session = await requireSession();
  const analyses = await listAnalyses(session.workspace.id);

  return (
    <ReviewView
      analyses={analyses}
      members={session.workspace.members}
      aiConfigured={isAiConfigured()}
      serverNow={now.toISOString()}
    />
  );
}

function ReviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[64rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-[32rem]" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-2.5 rounded-xl border border-line bg-surface p-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-64" />
          <Skeleton className="h-3 w-full" />
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
          </div>
        </div>
      ))}
    </div>
  );
}
