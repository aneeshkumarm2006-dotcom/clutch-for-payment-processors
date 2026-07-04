"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { MONTHLY_VOLUMES, REVIEW_COMPANY_SIZES, SUB_RATING_KEYS } from "@/lib/enums";
import { reviewInput } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { StarRatingInput } from "@/components/public/StarRatingInput";
import { HONEYPOT_FIELD } from "@/lib/rate-limit";

const SUB_RATING_LABELS: Record<(typeof SUB_RATING_KEYS)[number], string> = {
  easeOfUse: "Ease of use",
  pricing: "Pricing",
  support: "Support",
  features: "Features",
  reliability: "Reliability",
};

interface ReviewFormValues {
  reviewerName: string;
  reviewerTitle: string;
  companyName: string;
  companySize: string;
  industry: string;
  reviewerEmail: string;
  overallRating: number;
  subRatings: { easeOfUse: number; pricing: number; support: number; features: number; reliability: number };
  title: string;
  body: string;
  pros: string;
  cons: string;
  useCase: string;
  monthlyVolume: string;
  [HONEYPOT_FIELD]: string;
}

function blank(): ReviewFormValues {
  return {
    reviewerName: "",
    reviewerTitle: "",
    companyName: "",
    companySize: "",
    industry: "",
    reviewerEmail: "",
    overallRating: 0,
    subRatings: { easeOfUse: 0, pricing: 0, support: 0, features: 0, reliability: 0 },
    title: "",
    body: "",
    pros: "",
    cons: "",
    useCase: "",
    monthlyVolume: "",
    [HONEYPOT_FIELD]: "",
  };
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function WriteReviewForm({
  processorId,
  processorName,
  processorSlug,
}: {
  processorId: string;
  processorName: string;
  processorSlug: string;
}) {
  const form = useForm<ReviewFormValues>({ defaultValues: blank() });
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;

  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      processor: processorId,
      reviewerName: values.reviewerName,
      reviewerTitle: blankToUndef(values.reviewerTitle),
      companyName: blankToUndef(values.companyName),
      companySize: blankToUndef(values.companySize),
      industry: blankToUndef(values.industry),
      reviewerEmail: values.reviewerEmail,
      overallRating: values.overallRating,
      subRatings: values.subRatings,
      title: values.title,
      body: values.body,
      pros: blankToUndef(values.pros),
      cons: blankToUndef(values.cons),
      useCase: blankToUndef(values.useCase),
      monthlyVolume: blankToUndef(values.monthlyVolume),
    };

    const parsed = reviewInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path.join(".") as keyof ReviewFormValues, {
          type: "manual",
          message: issue.message,
        });
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Include the honeypot field so the server can inspect it.
        body: JSON.stringify({ ...parsed.data, [HONEYPOT_FIELD]: values[HONEYPOT_FIELD] }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not submit your review. Please try again.");
      }
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
        <h2 className="mt-4 text-h3 tracking-tighter2">Thanks, your review is pending moderation</h2>
        <p className="mx-auto mt-2 max-w-prose text-body text-muted-foreground">
          We review every submission before it goes live to keep ratings trustworthy. Once approved,
          your review will appear on the {processorName} profile.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/processor/${processorSlug}`} className={cn(buttonVariants({ variant: "primary" }))}>
            Back to {processorName}
          </Link>
          <Link href="/processors" className={cn(buttonVariants({ variant: "secondary" }))}>
            Browse processors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {errors.root?.message && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      {/* Honeypot — visually hidden, off-screen, not announced. Bots fill it. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Company website (leave blank)</label>
        <input
          id={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register(HONEYPOT_FIELD)}
        />
      </div>

      {/* Ratings */}
      <Fieldset legend="Your ratings" description="Tap the stars to rate each area (1–5).">
        <div className="space-y-4">
          <Controller
            control={control}
            name="overallRating"
            render={({ field }) => (
              <RatingRow
                label="Overall rating"
                value={field.value}
                onChange={field.onChange}
                error={errors.overallRating?.message}
                emphasis
              />
            )}
          />
          {SUB_RATING_KEYS.map((key) => (
            <Controller
              key={key}
              control={control}
              name={`subRatings.${key}` as const}
              render={({ field }) => (
                <RatingRow
                  label={SUB_RATING_LABELS[key]}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.subRatings?.[key]?.message}
                />
              )}
            />
          ))}
        </div>
      </Fieldset>

      {/* The review */}
      <Fieldset legend="Your review">
        <Field label="Title" error={errors.title?.message} required>
          <Input placeholder="Summarize your experience" {...register("title")} />
        </Field>
        <Field label="Review" error={errors.body?.message} required>
          <Textarea
            rows={5}
            placeholder={`What was it like using ${processorName}? Pricing, support, reliability…`}
            {...register("body")}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Pros" hint="Optional">
            <Textarea rows={3} placeholder="What worked well?" {...register("pros")} />
          </Field>
          <Field label="Cons" hint="Optional">
            <Textarea rows={3} placeholder="What could be better?" {...register("cons")} />
          </Field>
        </div>
        <Field label="Use case" hint="Optional">
          <Input placeholder="e.g. Subscription billing for a SaaS" {...register("useCase")} />
        </Field>
      </Fieldset>

      {/* About you */}
      <Fieldset legend="About you" description="Your email stays private and is only used to verify the review.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" error={errors.reviewerName?.message} required>
            <Input placeholder="Alex Morgan" autoComplete="name" {...register("reviewerName")} />
          </Field>
          <Field label="Email" error={errors.reviewerEmail?.message} required hint="Private">
            <Input type="email" placeholder="you@company.com" autoComplete="email" {...register("reviewerEmail")} />
          </Field>
          <Field label="Job title" hint="Optional">
            <Input placeholder="Head of Payments" {...register("reviewerTitle")} />
          </Field>
          <Field label="Company" hint="Optional">
            <Input placeholder="Company name" autoComplete="organization" {...register("companyName")} />
          </Field>
          <SelectField
            control={control}
            name="companySize"
            label="Company size"
            options={REVIEW_COMPANY_SIZES}
            placeholder="Select size"
          />
          <Field label="Industry" hint="Optional">
            <Input placeholder="e.g. E-commerce" {...register("industry")} />
          </Field>
          <SelectField
            control={control}
            name="monthlyVolume"
            label="Monthly volume"
            options={MONTHLY_VOLUMES}
            placeholder="Select volume"
          />
        </div>
      </Fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <p className="text-small text-muted-foreground">
          Submitted reviews are moderated before they appear.
        </p>
        <div className="flex gap-3">
          <Link
            href={`/processor/${processorSlug}`}
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Cancel
          </Link>
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Submit review
          </Button>
        </div>
      </div>
    </form>
  );
}

function Fieldset({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-5 rounded-lg border border-border bg-card p-5 lg:p-6">
      <legend className="px-1">
        <span className="text-h4 text-foreground">{legend}</span>
      </legend>
      {description && <p className="-mt-2 text-small text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
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

function RatingRow({
  label,
  value,
  onChange,
  error,
  emphasis,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  error?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={cn("text-body", emphasis ? "font-semibold text-foreground" : "text-muted-foreground")}>
        {label}
        {emphasis && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <div className="flex flex-col items-end">
        <StarRatingInput label={label} value={value} onChange={onChange} size={emphasis ? 30 : 24} />
        {error && <p className="text-small text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function SelectField({
  control,
  name,
  label,
  options,
  placeholder,
}: {
  control: ReturnType<typeof useForm<ReviewFormValues>>["control"];
  name: "companySize" | "monthlyVolume";
  label: string;
  options: readonly string[];
  placeholder: string;
}) {
  return (
    <Field label={label} hint="Optional">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}

export default WriteReviewForm;
