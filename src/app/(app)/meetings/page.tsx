import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { listMeetings } from "@/lib/data/meetings";
import { isAiConfigured } from "@/lib/ai/extract";
import { googleIntegrationStatus } from "@/lib/google/config";
import { getConnectedAccount } from "@/lib/google/oauth";
import { MeetingsList } from "@/components/meetings/meetings-list";
import { Skeleton } from "@/components/ui/feedback";

// Session-gated: this segment reads the auth cookie, so it cannot be
// prerendered ahead of knowing who is signed in.
export const instant = false;

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return (
    <Suspense fallback={<MeetingsSkeleton />}>
      <MeetingsData />
    </Suspense>
  );
}

async function MeetingsData() {
  await connection();
  const now = new Date();
  const session = await requireSession();

  const [meetings, googleAccount] = await Promise.all([
    listMeetings(session.workspace.id),
    getConnectedAccount(session.userId),
  ]);

  const googleStatus = googleIntegrationStatus();

  return (
    <MeetingsList
      meetings={meetings}
      members={session.workspace.members}
      currentMemberId={session.member.id}
      serverNow={now.toISOString()}
      aiConfigured={isAiConfigured()}
      google={{
        configured: googleStatus.configured,
        connected: Boolean(googleAccount),
        email: googleAccount?.googleEmail ?? null,
      }}
    />
  );
}

function MeetingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 px-3 py-4 sm:px-4 lg:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-80" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-line bg-surface px-3 py-3">
          <Skeleton className="h-3.5 w-52" />
          <Skeleton className="h-2.5 w-40" />
          <Skeleton className="h-2.5 w-64" />
        </div>
      ))}
    </div>
  );
}
