"use client";

import { ArrowRight, Bot, Maximize2, Monitor, User } from "lucide-react";
import { useState } from "react";
import {
  hasSketch,
  type Sketch,
  type SketchActor,
  type SketchBlock,
  type SketchScreen,
} from "@/shared/domain/sketch";
import { useT } from "@/frontend/i18n";
import { cn } from "@/frontend/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/frontend/components/ui/dialog";
import { Tooltip } from "@/frontend/components/ui/feedback";

/**
 * Draws what the assistant sketched.
 *
 * Every block kind gets its own skeleton, because the whole value of a sketch
 * is recognising the shape at a glance — a table has to look like a table and a
 * form like a form, or it is just a list of words in a box. The labels inside
 * are always the model's text, placed by this component; nothing here is
 * markup, which is what makes drawing an answer from a model safe at all.
 *
 * The drawer is narrow, so the sidebar version stacks everything in one column
 * and the expand button opens the same drawing with room to read it.
 */
export function SketchView({ sketch }: { sketch: Sketch }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  if (!hasSketch(sketch)) return null;

  return (
    <>
      <figure className="rounded-lg border border-line bg-canvas">
        <figcaption className="flex items-start gap-2 border-b border-line px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("sketch.heading")}</p>
            {sketch.title && (
              <p className="mt-0.5 text-2xs font-medium text-text">{sketch.title}</p>
            )}
            {sketch.caption && (
              <p className="mt-0.5 text-2xs leading-4 text-text-muted">{sketch.caption}</p>
            )}
          </div>
          <Tooltip content={t("sketch.expand")}>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("sketch.expand")}
              onClick={() => setExpanded(true)}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </Tooltip>
        </figcaption>

        <div className="space-y-3 p-2.5">
          <SketchBody sketch={sketch} columns={1} />
          <p className="text-2xs text-text-faint">{t("sketch.note")}</p>
        </div>
      </figure>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        {expanded && (
          <DialogContent
            aria-describedby={undefined}
            className="max-h-[90vh] max-w-[min(70rem,calc(100%-3rem))]"
          >
            <div className="shrink-0 border-b border-line px-5 py-3">
              <DialogTitle className="truncate">
                {sketch.title || t("sketch.heading")}
              </DialogTitle>
              {sketch.caption && (
                <p className="mt-0.5 text-xs text-text-muted">{sketch.caption}</p>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <SketchBody sketch={sketch} columns={sketch.screens.length > 1 ? 2 : 1} />
              <p className="mt-4 text-2xs text-text-faint">{t("sketch.note")}</p>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function SketchBody({ sketch, columns }: { sketch: Sketch; columns: 1 | 2 }) {
  const t = useT();

  return (
    <div className="space-y-4">
      {sketch.screens.length > 0 && (
        <div
          className={cn(
            "grid gap-3",
            columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {sketch.screens.map((screen, index) => (
            <Screen key={index} screen={screen} step={index + 1} />
          ))}
        </div>
      )}

      {sketch.flow.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5">{t("sketch.flow")}</p>
          <Flow sketch={sketch} />
        </div>
      )}
    </div>
  );
}

/** One screen, drawn inside a window frame so a stack of them reads as screens. */
function Screen({ screen, step }: { screen: SketchScreen; step: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-strong bg-surface">
      <div className="flex items-center gap-1.5 border-b border-line bg-raised px-2 py-1.5">
        <span className="flex gap-1" aria-hidden>
          <Chrome />
          <Chrome />
          <Chrome />
        </span>
        <span className="min-w-0 flex-1 truncate text-2xs font-medium text-text-secondary">
          {screen.title}
        </span>
        <span className="shrink-0 rounded-full bg-canvas px-1.5 text-2xs tabular-nums text-text-faint">
          {step}
        </span>
      </div>

      <div className="space-y-1.5 p-2">
        {screen.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </div>

      {screen.caption && (
        <p className="border-t border-line px-2 py-1.5 text-2xs leading-4 text-text-muted">
          {screen.caption}
        </p>
      )}
    </div>
  );
}

function Chrome() {
  return <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />;
}

function Block({ block }: { block: SketchBlock }) {
  const t = useT();

  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5",
        block.emphasis
          ? "tone-accent border-line-accent bg-[var(--tone-bg)]"
          : "border-line bg-canvas",
      )}
    >
      <p className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "truncate text-2xs font-medium",
            block.emphasis ? "text-[var(--tone-fg)]" : "text-text-secondary",
          )}
        >
          {block.label}
        </span>
        <span className="shrink-0 text-[9px] uppercase tracking-wide text-text-faint">
          {t(`sketch.block.${block.kind}`)}
        </span>
      </p>
      {block.lines.length > 0 && <BlockBody block={block} />}
    </div>
  );
}

/**
 * The skeleton for one block kind.
 *
 * These are drawn with the same bars and boxes a wireframe uses, with the
 * model's own words laid on top — close enough to a mock-up to argue about the
 * layout, far enough from one that nobody mistakes it for a design.
 */
function BlockBody({ block }: { block: SketchBlock }) {
  const { kind, lines } = block;

  switch (kind) {
    case "header":
      return (
        <div className="mt-1 space-y-1">
          <p className="text-xs font-semibold leading-4 text-text">{lines[0]}</p>
          {lines.slice(1).map((line, index) => (
            <p key={index} className="text-2xs leading-4 text-text-muted">
              {line}
            </p>
          ))}
        </div>
      );

    case "toolbar":
    case "nav":
      return (
        <div className="mt-1 flex flex-wrap gap-1">
          {lines.map((line, index) => (
            <span
              key={index}
              className={cn(
                "rounded-[4px] px-1.5 py-0.5 text-2xs",
                index === 0 && kind === "nav"
                  ? "bg-accent-dim text-text"
                  : "bg-raised text-text-muted",
              )}
            >
              {line}
            </span>
          ))}
        </div>
      );

    case "list":
      return (
        <ul className="mt-1 space-y-1">
          {lines.map((line, index) => (
            <li key={index} className="flex items-center gap-1.5 rounded bg-raised px-1.5 py-1">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-2xs text-text-secondary">{line}</span>
              <span className="h-1 w-6 shrink-0 rounded-full bg-line" aria-hidden />
            </li>
          ))}
        </ul>
      );

    case "cards":
      return (
        <div className="mt-1 grid grid-cols-2 gap-1">
          {lines.map((line, index) => (
            <div key={index} className="rounded border border-line bg-raised px-1.5 py-1.5">
              <p className="truncate text-2xs text-text-secondary">{line}</p>
              <span className="mt-1 block h-1 w-8 rounded-full bg-line-strong" aria-hidden />
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <div className="mt-1 overflow-hidden rounded border border-line">
          <div className="flex gap-1 border-b border-line bg-raised px-1.5 py-1">
            {lines.map((line, index) => (
              <span
                key={index}
                className="min-w-0 flex-1 truncate text-[9px] uppercase tracking-wide text-text-faint"
              >
                {line}
              </span>
            ))}
          </div>
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-1 border-b border-line px-1.5 py-1 last:border-0">
              {lines.map((_, index) => (
                <span
                  key={index}
                  className="h-1.5 min-w-0 flex-1 rounded-full bg-line"
                  aria-hidden
                />
              ))}
            </div>
          ))}
        </div>
      );

    case "form":
      return (
        <div className="mt-1 space-y-1">
          {lines.map((line, index) => (
            <div key={index}>
              <p className="text-[9px] text-text-faint">{line}</p>
              <span className="mt-0.5 block h-3.5 rounded border border-line bg-raised" aria-hidden />
            </div>
          ))}
        </div>
      );

    case "detail":
      return (
        <dl className="mt-1 space-y-0.5">
          {lines.map((line, index) => (
            <div key={index} className="flex items-baseline gap-2">
              <dt className="w-16 shrink-0 truncate text-[9px] text-text-faint">{line}</dt>
              <dd className="h-1.5 min-w-0 flex-1 rounded-full bg-line" aria-hidden />
            </div>
          ))}
        </dl>
      );

    case "chart":
      return (
        <div className="mt-1">
          <div className="flex h-10 items-end gap-1" aria-hidden>
            {lines.map((_, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-[2px] bg-accent-dim"
                // A fixed rising-then-settling shape: the bars say "a chart
                // goes here", and a random height per render would make the
                // same sketch look different every time it is opened.
                style={{ height: `${[40, 70, 55, 90, 65, 80][index % 6]}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            {lines.map((line, index) => (
              <span
                key={index}
                className="min-w-0 flex-1 truncate text-center text-[9px] text-text-faint"
              >
                {line}
              </span>
            ))}
          </div>
        </div>
      );

    case "empty":
      return (
        <div className="mt-1 rounded border border-dashed border-line-strong px-2 py-3 text-center">
          {lines.map((line, index) => (
            <p
              key={index}
              className={cn(
                "text-2xs leading-4",
                index === 0 ? "text-text-secondary" : "text-text-faint",
              )}
            >
              {line}
            </p>
          ))}
        </div>
      );

    case "banner":
      return (
        <div className="mt-1 space-y-0.5 rounded border-l-2 border-line-accent bg-raised px-2 py-1">
          {lines.map((line, index) => (
            <p key={index} className="text-2xs leading-4 text-text-secondary">
              {line}
            </p>
          ))}
        </div>
      );

    case "actions":
      return (
        <div className="mt-1 flex flex-wrap justify-end gap-1">
          {lines.map((line, index) => (
            <span
              key={index}
              className={cn(
                "rounded-[4px] px-2 py-0.5 text-2xs",
                index === 0
                  ? "bg-accent-solid text-white"
                  : "border border-line text-text-muted",
              )}
            >
              {line}
            </span>
          ))}
        </div>
      );
  }
}

const actorIcons: Record<SketchActor, typeof User> = {
  PERSON: User,
  SYSTEM: Monitor,
  AI: Bot,
};

/** The path end to end. Wraps rather than scrolls, so nothing hides off-screen. */
function Flow({ sketch }: { sketch: Sketch }) {
  const t = useT();

  return (
    <ol className="space-y-1">
      {sketch.flow.map((step, index) => {
        const Icon = actorIcons[step.actor] ?? Monitor;
        return (
          <li key={index} className="flex gap-2">
            <span className="flex shrink-0 flex-col items-center">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-text-muted">
                <Icon className="h-3 w-3" />
              </span>
              {index < sketch.flow.length - 1 && (
                <span className="my-0.5 w-px flex-1 bg-line" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1 pb-1.5">
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xs font-medium text-text">{step.label}</span>
                <span className="text-[9px] uppercase tracking-wide text-text-faint">
                  {t(`sketch.actor.${step.actor}`)}
                </span>
              </p>
              {step.detail && (
                <p className="mt-0.5 flex gap-1 text-2xs leading-4 text-text-muted">
                  <ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden />
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
