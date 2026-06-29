"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { MONTHLY_VOLUMES } from "@/lib/enums";
import { leadInput } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { HONEYPOT_FIELD } from "@/lib/rate-limit";
import { Button, buttonVariants, type ButtonProps } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisitWebsiteButton } from "@/components/public/VisitWebsiteButton";

/**
 * LeadDialog (PRD §9.4/§9.10 / §5.3) — the single lead-capture dialog used for
 * "Get a quote" (processor-specific) and "Get matched" (generic). Posts to
 * `POST /api/leads` with a hidden honeypot; on success it shows a confirmation
 * (plus a "Visit website" shortcut for the quote variant) so the CTA is never a
 * dead end.
 */

interface LeadFormValues {
  name: string;
  email: string;
  businessName: string;
  phone: string;
  monthlyVolume: string;
  businessType: string;
  message: string;
  [HONEYPOT_FIELD]: string;
}

const blankToUndef = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function LeadDialog({
  processorId,
  processorName,
  website,
  affiliateUrl,
  source,
  triggerLabel,
  triggerVariant = "accent",
  triggerSize = "md",
  triggerClassName,
  fullWidth = false,
}: {
  /** Processor ObjectId — omit for a generic "get matched" lead. */
  processorId?: string;
  processorName?: string;
  website?: string;
  affiliateUrl?: string;
  /** Which CTA/page this lead came from (PRD §8.4 `source`). */
  source?: string;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  fullWidth?: boolean;
}) {
  const isQuote = Boolean(processorName);
  const label = triggerLabel ?? (isQuote ? "Get a quote" : "Get matched");
  const resolvedSource = source ?? (isQuote ? "quote" : "get-matched");

  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormValues>({
    defaultValues: {
      name: "",
      email: "",
      businessName: "",
      phone: "",
      monthlyVolume: "",
      businessType: "",
      message: "",
      [HONEYPOT_FIELD]: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      processor: processorId,
      name: values.name,
      email: values.email,
      businessName: blankToUndef(values.businessName),
      phone: blankToUndef(values.phone),
      monthlyVolume: blankToUndef(values.monthlyVolume),
      businessType: blankToUndef(values.businessType),
      message: blankToUndef(values.message),
      source: resolvedSource,
    };

    const parsed = leadInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path === "name" || path === "email") {
          setError(path, { type: "manual", message: issue.message });
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
        throw new Error(data.error || "Could not send your request. Please try again.");
      }
      trackEvent("lead_submit", { processor: processorId ?? "", source: resolvedSource });
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

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Reset after the close animation so the form is fresh next time.
      setTimeout(() => {
        setDone(false);
        reset();
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          trackEvent("get_quote", { processor: processorId ?? "", source: resolvedSource });
        }}
        className={cn(
          buttonVariants({ variant: triggerVariant, size: triggerSize }),
          fullWidth && "w-full",
          triggerClassName,
        )}
      >
        {label}
      </button>

      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-10 text-accent" aria-hidden />
            <DialogTitle className="mt-4 text-h3 tracking-tighter2">
              Thanks — we’ve got your request
            </DialogTitle>
            <DialogDescription className="mx-auto mt-2 max-w-prose">
              {isQuote
                ? `Our team will be in touch about ${processorName}. In the meantime you can head straight to their site.`
                : "We’ll review your needs and follow up with matched processors shortly."}
            </DialogDescription>
            <div className="mt-6 flex flex-col gap-2">
              {isQuote && website && (
                <VisitWebsiteButton
                  website={website}
                  affiliateUrl={affiliateUrl}
                  slug={processorName ?? ""}
                  label={`Visit ${processorName}`}
                  variant="primary"
                  className="w-full"
                />
              )}
              <Button variant="secondary" className="w-full" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {isQuote ? `Get a quote from ${processorName}` : "Find your processor"}
              </DialogTitle>
              <DialogDescription>
                {isQuote
                  ? "Tell us a little about your business and we’ll help you get a tailored quote."
                  : "Tell us about your business and we’ll match you with suitable processors. No obligation."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {errors.root?.message && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-small text-destructive">
                  {errors.root.message}
                </p>
              )}

              {/* Honeypot — off-screen, not announced. Bots fill it. */}
              <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor={`lead-${HONEYPOT_FIELD}`}>Company website (leave blank)</label>
                <input
                  id={`lead-${HONEYPOT_FIELD}`}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  {...register(HONEYPOT_FIELD)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <LeadField label="Your name" error={errors.name?.message} required>
                  <Input placeholder="Alex Morgan" autoComplete="name" {...register("name")} />
                </LeadField>
                <LeadField label="Email" error={errors.email?.message} required>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    {...register("email")}
                  />
                </LeadField>
                <LeadField label="Business name" hint="Optional">
                  <Input
                    placeholder="Company name"
                    autoComplete="organization"
                    {...register("businessName")}
                  />
                </LeadField>
                <LeadField label="Phone" hint="Optional">
                  <Input type="tel" placeholder="+1 555 000 0000" autoComplete="tel" {...register("phone")} />
                </LeadField>
                <LeadField label="Monthly volume" hint="Optional">
                  <Select
                    value={watch("monthlyVolume") || undefined}
                    onValueChange={(v) => setValue("monthlyVolume", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select volume" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHLY_VOLUMES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </LeadField>
                <LeadField label="Business type" hint="Optional">
                  <Input placeholder="e.g. E-commerce, SaaS" {...register("businessType")} />
                </LeadField>
              </div>

              <LeadField label="Anything else?" hint="Optional">
                <Textarea
                  rows={3}
                  placeholder="What are you looking for? Current processor, pain points, must-haves…"
                  {...register("message")}
                />
              </LeadField>

              <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {isQuote ? "Request quote" : "Get matched"}
              </Button>
              <p className="text-center text-micro text-muted-foreground">
                Your details are private and only used to handle your request.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LeadField({
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

export default LeadDialog;
