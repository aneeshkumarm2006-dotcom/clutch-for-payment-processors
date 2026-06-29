"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { leadInput } from "@/lib/validators";
import { HONEYPOT_FIELD } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Contact form (PRD §9.10). Reuses the public lead endpoint with
 * `source: 'contact'` (per the Lead validator note) — honeypot + rate-limited at
 * the route. On success it shows an inline confirmation rather than a dead end.
 */
interface ContactFormValues {
  name: string;
  email: string;
  businessName: string;
  message: string;
  [HONEYPOT_FIELD]: string;
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function ContactForm() {
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContactFormValues>({
    defaultValues: { name: "", email: "", businessName: "", message: "", [HONEYPOT_FIELD]: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!values.message.trim()) {
      setError("message", { type: "manual", message: "Please include a short message." });
      return;
    }
    const payload = {
      name: values.name,
      email: values.email,
      businessName: blankToUndef(values.businessName),
      message: values.message,
      source: "contact",
    };
    const parsed = leadInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path === "name" || path === "email" || path === "message") {
          setError(path as keyof ContactFormValues, { type: "manual", message: issue.message });
        } else {
          setError("root", { type: "manual", message: issue.message });
        }
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, [HONEYPOT_FIELD]: values[HONEYPOT_FIELD] }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not send your message. Please try again.");
      }
      trackEvent("lead_submit", { source: "contact" });
      setDone(true);
    } catch (err) {
      setError("root", {
        type: "manual",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  if (done) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-accent" aria-hidden />
        <h2 className="mt-4 text-h3 tracking-tighter2 text-foreground">Thanks for reaching out</h2>
        <p className="mx-auto mt-2 max-w-prose text-body text-muted-foreground">
          We’ve received your message and will get back to you by email shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border bg-card p-6">
      {errors.root?.message && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      {/* Honeypot — off-screen, not announced. Bots fill it. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`contact-${HONEYPOT_FIELD}`}>Company website (leave blank)</label>
        <input
          id={`contact-${HONEYPOT_FIELD}`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register(HONEYPOT_FIELD)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message} required>
          <Input placeholder="Alex Morgan" autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Email" error={errors.email?.message} required>
          <Input
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
          />
        </Field>
      </div>
      <Field label="Business name" hint="Optional">
        <Input placeholder="Company name" autoComplete="organization" {...register("businessName")} />
      </Field>
      <Field label="Message" error={errors.message?.message} required>
        <Textarea
          rows={5}
          placeholder="How can we help? Feedback, a correction, a partnership…"
          {...register("message")}
        />
      </Field>

      <Button type="submit" variant="accent" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Send message
      </Button>
      <p className="text-micro text-muted-foreground">
        Your details are private and only used to handle your enquiry.
      </p>
    </form>
  );
}

function Field({
  label,
  children,
  error,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {hint && <span className="text-micro text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-small text-destructive">{error}</p>}
    </div>
  );
}

export default ContactForm;
