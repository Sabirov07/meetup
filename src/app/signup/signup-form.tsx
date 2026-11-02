"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { signUp } from "@/backend/actions/auth";
import { Button } from "@/frontend/components/ui/button";
import { Field, Input } from "@/frontend/components/ui/field";

const MIN_PASSWORD = 8;

export function SignUpForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    setError(null);
    startTransition(async () => {
      const result = await signUp({ name, email, password });
      if (result.ok) {
        router.replace("/");
        // The shell is a server component, so the fresh session has to be
        // fetched rather than read from the client router cache.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      <Field label="Your name" htmlFor="name">
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          autoFocus
          required
          placeholder="Alex Morgan"
        />
      </Field>

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint={`${MIN_PASSWORD} characters or more`}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          placeholder="••••••••••"
        />
      </Field>

      {error && (
        <div
          role="alert"
          className="tone-danger flex items-start gap-2 rounded-md bg-[var(--tone-bg)] px-2.5 py-2 text-xs leading-5 text-[var(--tone-fg)]"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        loading={pending}
        loadingLabel="Creating your workspace…"
      >
        Create account
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}
