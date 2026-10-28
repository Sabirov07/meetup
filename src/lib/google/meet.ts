import "server-only";

import { MEET_API_BASE } from "./config";
import { getAccessToken } from "./oauth";

/**
 * Google Meet REST API v2 client.
 *
 * Only the endpoints this product needs, called with plain `fetch` rather than
 * the full `googleapis` package — the surface is small enough that the extra
 * dependency would not pay for itself.
 *
 * Endpoints used (v2):
 *   POST /spaces
 *   GET  /conferenceRecords?filter=space.name="spaces/..."
 *   GET  /conferenceRecords/{id}/transcripts
 *   GET  /conferenceRecords/{id}/transcripts/{id}/entries
 */

export class MeetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True when retrying later could plausibly succeed. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "MeetApiError";
  }
}

async function call<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken(userId);
  const response = await fetch(`${MEET_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    // 403 here usually means the scope was granted but the account's Workspace
    // edition does not include the feature — worth saying plainly.
    const retryable = response.status === 429 || response.status >= 500;
    throw new MeetApiError(
      `Google Meet API ${response.status}: ${body.slice(0, 300)}`,
      response.status,
      retryable,
    );
  }

  return (await response.json()) as T;
}

export type MeetSpace = {
  /** Resource name, e.g. "spaces/abc123". */
  name: string;
  meetingUri: string;
  meetingCode: string;
};

/** Creates a brand-new meeting space and returns its real join URL. */
export async function createSpace(userId: string): Promise<MeetSpace> {
  const space = await call<{
    name: string;
    meetingUri?: string;
    meetingCode?: string;
  }>(userId, "/spaces", { method: "POST", body: JSON.stringify({}) });

  if (!space.meetingUri) {
    throw new MeetApiError("Google created the space but returned no join URL.", 502, true);
  }

  return {
    name: space.name,
    meetingUri: space.meetingUri,
    meetingCode: space.meetingCode ?? "",
  };
}

export type ConferenceRecord = {
  name: string;
  startTime: string;
  endTime?: string;
};

/** Conference records for a space, newest first. Empty until a call happens. */
export async function listConferenceRecords(
  userId: string,
  spaceName: string,
): Promise<ConferenceRecord[]> {
  const filter = encodeURIComponent(`space.name="${spaceName}"`);
  const data = await call<{ conferenceRecords?: ConferenceRecord[] }>(
    userId,
    `/conferenceRecords?filter=${filter}`,
  );
  return data.conferenceRecords ?? [];
}

export type MeetTranscript = {
  name: string;
  state?: string;
  startTime?: string;
  endTime?: string;
};

export async function listTranscripts(
  userId: string,
  conferenceRecordName: string,
): Promise<MeetTranscript[]> {
  const data = await call<{ transcripts?: MeetTranscript[] }>(
    userId,
    `/${conferenceRecordName}/transcripts`,
  );
  return data.transcripts ?? [];
}

export type TranscriptEntry = {
  name: string;
  participant: string;
  text: string;
  languageCode?: string;
  startTime?: string;
  endTime?: string;
};

/** Pages through every entry for a transcript. */
export async function listTranscriptEntries(
  userId: string,
  transcriptName: string,
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) query.set("pageToken", pageToken);
    const data = await call<{ transcriptEntries?: TranscriptEntry[]; nextPageToken?: string }>(
      userId,
      `/${transcriptName}/entries?${query.toString()}`,
    );
    entries.push(...(data.transcriptEntries ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return entries;
}

export type ParticipantInfo = { name: string; displayName: string };

/** Maps participant resource names to display names for speaker labels. */
export async function listParticipants(
  userId: string,
  conferenceRecordName: string,
): Promise<Map<string, string>> {
  type Participant = {
    name: string;
    signedinUser?: { displayName?: string };
    anonymousUser?: { displayName?: string };
    phoneUser?: { displayName?: string };
  };

  const data = await call<{ participants?: Participant[] }>(
    userId,
    `/${conferenceRecordName}/participants`,
  );

  const map = new Map<string, string>();
  for (const p of data.participants ?? []) {
    const label =
      p.signedinUser?.displayName ??
      p.anonymousUser?.displayName ??
      p.phoneUser?.displayName ??
      "Unknown speaker";
    map.set(p.name, label);
  }
  return map;
}

/**
 * Turns entries into the transcript shape we store: readable text plus
 * structured turns. Speaker names come from the participants list where
 * available, and fall back to a stable anonymous label.
 */
export function composeTranscript(
  entries: TranscriptEntry[],
  participants: Map<string, string>,
): { content: string; turns: { speaker: string; text: string; startedAt: string | null }[] } {
  const anonymous = new Map<string, string>();

  const turns = entries.map((entry) => {
    let speaker = participants.get(entry.participant);
    if (!speaker) {
      if (!anonymous.has(entry.participant)) {
        anonymous.set(entry.participant, `Speaker ${anonymous.size + 1}`);
      }
      speaker = anonymous.get(entry.participant)!;
    }
    return {
      speaker,
      text: entry.text.trim(),
      startedAt: entry.startTime ?? null,
    };
  });

  return {
    content: turns.map((t) => `${t.speaker}: ${t.text}`).join("\n"),
    turns,
  };
}
