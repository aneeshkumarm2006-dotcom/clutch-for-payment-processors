"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  MONTHLY_VOLUMES,
  REVIEW_COMPANY_SIZES,
  SUB_RATING_KEYS,
  type SubRatingKey,
} from "@/lib/enums";
import { reviewAdminInput } from "@/lib/validators";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EnumSelectField,
  SwitchField,
  TextField,
  TextareaField,
} from "@/components/admin/fields/form-fields";
import { StarRatingInput } from "@/components/public/StarRatingInput";

const SUB_LABELS: Record<SubRatingKey, string> = {
  easeOfUse: "Ease of use",
  pricing: "Pricing",
  support: "Support",
  features: "Features",
  reliability: "Reliability",
};

const raw = (v: string) => v;

interface AdminReviewFormValues {
  processor: string;
  reviewerName: string;
  reviewerTitle: string;
  companyName: string;
  companySize: string;
  industry: string;
  reviewerEmail: string;
  overallRating: number;
  subRatings: Record<SubRatingKey, number>;
  title: string;
  body: string;
  pros: string;
  cons: string;
  useCase: string;
  monthlyVolume: string;
  isVerified: boolean;
}

function blank(): AdminReviewFormValues {
  return {
    processor: "",
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
    isVerified: true,
  };
}

const undef = (v: string) => (v.trim() === "" ? undefined : v.trim());

export function ReviewForm({ processors }: { processors: { id: string; name: string }[] }) {
  const router = useRouter();
  const form = useForm<AdminReviewFormValues>({ defaultValues: blank() });
  const [saving, setSaving] = React.useState(false);

  const onSubmit = async () => {
    form.clearErrors();
    const v = form.getValues();
    const payload = {
      processor: v.processor,
      reviewerName: v.reviewerName,
      reviewerTitle: undef(v.reviewerTitle),
      companyName: undef(v.companyName),
      companySize: undef(v.companySize),
      industry: undef(v.industry),
      reviewerEmail: v.reviewerEmail,
      overallRating: v.overallRating,
      subRatings: v.subRatings,
      title: v.title,
      body: v.body,
      pros: undef(v.pros),
      cons: undef(v.cons),
      useCase: undef(v.useCase),
      monthlyVolume: undef(v.monthlyVolume),
      isVerified: v.isVerified,
      source: "admin-entry" as const,
    };

    const parsed = reviewAdminInput.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        form.setError(issue.path.join(".") as keyof AdminReviewFormValues, {
          type: "manual",
          message: issue.message,
        });
      }
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("/api/reviews", parsed.data as Record<string, unknown>);
      toast.success("Review added and approved.");
      router.push("/admin/reviews");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.fieldErrors) {
          for (const [key, msgs] of Object.entries(err.fieldErrors)) {
            const msg = msgs[0];
            if (msg) form.setError(key as keyof AdminReviewFormValues, { type: "manual", message: msg });
          }
        }
        toast.error(err.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <h1 className="text-h1 tracking-tighter2">Add review</h1>
        <p className="-mt-3 text-body text-muted-foreground">
          Manually entered reviews are saved as <code>admin-entry</code> and approved immediately, so
          they count toward the processor’s rating right away.
        </p>

        {/* Processor + ratings */}
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <FormField
            control={form.control}
            name="processor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Processor</FormLabel>
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a processor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {processors.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <StarField name="overallRating" label="Overall rating" emphasis />
            {SUB_RATING_KEYS.map((key) => (
              <StarField key={key} name={`subRatings.${key}`} label={SUB_LABELS[key]} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <TextField name="title" label="Title" placeholder="Summary of the review" />
          <TextareaField name="body" label="Review" rows={5} placeholder="The full review text." />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextareaField name="pros" label="Pros" rows={3} />
            <TextareaField name="cons" label="Cons" rows={3} />
          </div>
          <TextField name="useCase" label="Use case" placeholder="e.g. SaaS subscription billing" />
        </div>

        {/* Reviewer */}
        <div className="space-y-5 rounded-lg border border-border bg-card p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="reviewerName" label="Reviewer name" placeholder="Alex Morgan" />
            <TextField name="reviewerEmail" label="Email (private)" type="email" placeholder="you@company.com" />
            <TextField name="reviewerTitle" label="Job title" placeholder="Head of Payments" />
            <TextField name="companyName" label="Company" placeholder="Company name" />
            <EnumSelectField
              name="companySize"
              label="Company size"
              options={REVIEW_COMPANY_SIZES}
              getLabel={raw}
            />
            <TextField name="industry" label="Industry" placeholder="e.g. E-commerce" />
            <EnumSelectField
              name="monthlyVolume"
              label="Monthly volume"
              options={MONTHLY_VOLUMES}
              getLabel={raw}
            />
          </div>
          <SwitchField
            name="isVerified"
            label="Verified"
            description="Show the verified badge on this review."
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/admin/reviews")} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Add review
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** A star-input field bound to react-hook-form via the surrounding <Form>. */
function StarField({ name, label, emphasis }: { name: string; label: string; emphasis?: boolean }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-wrap items-center justify-between gap-2 space-y-0">
          <FormLabel className={emphasis ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {label}
          </FormLabel>
          <div className="flex flex-col items-end">
            <FormControl>
              <StarRatingInput
                label={label}
                value={Number(field.value) || 0}
                onChange={field.onChange}
                size={emphasis ? 28 : 22}
              />
            </FormControl>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}

export default ReviewForm;
