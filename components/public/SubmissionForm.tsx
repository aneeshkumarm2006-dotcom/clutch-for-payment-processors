"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { LISTING_TIERS } from "@/lib/enums";
import { submissionInput } from "@/lib/validators";
import { humanizeEnum } from "@/lib/labels";
import { trackEvent } from "@/lib/analytics";
import { HONEYPOT_FIELD } from "@/lib/rate-limit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Public "list your processor" submission form (PRD §9.8 / TODO §5.4) → posts to
 * `POST /api/submissions` with a hidden honeypot. On success it shows a
 * confirmation; the submission lands in the admin inbox for review/conversion.
 */

interface SubmissionFormValues {
  processorName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  requestedTier: string;
  description: string;
  [HONEYPOT_FIELD]: string;
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function SubmissionForm() {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SubmissionFormValues>({
    defaultValues: {
      processorName: "",
      website: "",
      contactName: "",
      contactEmail: "",
      requestedTier: "",
      description: "",
      [HONEYPOT_FIELD]: "",
    },
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      processorName: values.processorName,
      website: values.website,
      contactName: values.contactName,
      contactEmail: values.contactEmail,
      requestedTier: blankToUndef(values.requestedTier),
      description: blankToUndef(values.description),
    };

    const parsed = submissionInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") as keyof SubmissionFormValues;
        setError(path, { type: "manual", message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, [HONEYPOT_FIELD]: values[HONEYPOT_FIELD] }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not send your submission. Please try again.");
      }
      trackEvent("submission_submit", { tier: parsed.data.requestedTier ?? "free" });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-accent" aria-hidden />
        <h2 className="mt-4 text-h3 tracking-tighter2">Thanks, we’ll be in touch</h2>
        <p className="mx-auto mt-2 max-w-prose text-body text-muted-foreground">
          We’ll review your processor and follow up about getting it listed. Most reviews take a few
          business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-lg border border-border bg-card p-6 lg:p-8">
      {errors.root?.message && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      {/* Honeypot — off-screen, not announced. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`sub-${HONEYPOT_FIELD}`}>Company website (leave blank)</label>
        <input id={`sub-${HONEYPOT_FIELD}`} type="text" tabIndex={-1} autoComplete="off" {...register(HONEYPOT_FIELD)} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <SubField label="Processor name" error={errors.processorName?.message} required>
          <Input placeholder="e.g. Acme Payments" {...register("processorName")} />
        </SubField>
        <SubField label="Website" error={errors.website?.message} required>
          <Input type="url" placeholder="https://…" {...register("website")} />
        </SubField>
        <SubField label="Your name" error={errors.contactName?.message} required>
          <Input placeholder="Contact name" autoComplete="name" {...register("contactName")} />
        </SubField>
        <SubField label="Work email" error={errors.contactEmail?.message} required>
          <Input type="email" placeholder="you@company.com" autoComplete="email" {...register("contactEmail")} />
        </SubField>
      </div>

      <SubField label="Requested tier" hint="Optional">
        <Select value={watch("requestedTier") || undefined} onValueChange={(v) => setValue("requestedTier", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select a tier" />
          </SelectTrigger>
          <SelectContent>
            {LISTING_TIERS.map((t) => (
              <SelectItem key={t} value={t}>
                {humanizeEnum(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SubField>

      <SubField label="Tell us about your processor" hint="Optional" error={errors.description?.message}>
        <Textarea
          rows={4}
          placeholder="What makes your processor a good fit? Pricing, supported regions, standout features…"
          {...register("description")}
        />
      </SubField>

      <Button type="submit" variant="accent" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Submit for review
      </Button>
    </form>
  );
}

function SubField({
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

export default SubmissionForm;
