import type { ActivityView } from "@/shared/domain/types";
import { useT } from "@/frontend/i18n";

/**
 * The one-line description of an event, in the language on screen.
 *
 * Stored summaries are written in whatever language the server was speaking at
 * the time, so they cannot be re-read in another one. The event's `type` can,
 * and the thing it happened to is looked up by id from the rows the page
 * already has. When that lookup fails — a deleted task, a page this screen
 * knows nothing about — the sentence is simply shown without the title, which
 * still reads correctly, rather than falling back to a language nobody asked
 * for.
 */
export function useActivityLine(titles: Map<string, string>): (event: ActivityView) => string {
  const t = useT();

  return (event) => {
    const sentence = t(`activity.line.${event.type}`);
    const subjectId = event.taskId ?? event.meetingId ?? event.knowledgeDocId;
    const title = subjectId ? titles.get(subjectId) : undefined;

    return title ? t("activity.withTitle", { sentence, title }) : sentence;
  };
}
