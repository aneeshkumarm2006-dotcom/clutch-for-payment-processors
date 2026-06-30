import type { BlogTemplate } from "@/lib/enums";

/**
 * SEO post templates offered in the /seoteam editor. Each provides a Tiptap-ready
 * HTML heading skeleton with placeholder guidance, tailored to the payment-
 * processing niche, so a non-technical author starts from a sensible structure.
 */

export interface SeoTemplate {
  id: BlogTemplate;
  label: string;
  description: string;
  /** Starter body HTML pre-filled into the editor when the template is chosen. */
  starterHtml: string;
}

export const SEO_TEMPLATES: SeoTemplate[] = [
  {
    id: "how-to",
    label: "How-To / Tutorial",
    description: "Step-by-step guide (e.g. how to accept payments or cut processing fees).",
    starterHtml: `<p>Brief intro: what the reader will achieve and who it's for (e.g. small merchants choosing a processor).</p>
<h2>What you'll need</h2>
<ul><li>Prerequisite or account</li><li>Tool or document</li></ul>
<h2>Step 1: …</h2>
<p>Explain the first step. Include exact fees, settings, or examples where helpful.</p>
<h2>Step 2: …</h2>
<p>…</p>
<h2>Step 3: …</h2>
<p>…</p>
<h2>Common mistakes to avoid</h2>
<ul><li>…</li></ul>
<h2>FAQ</h2>
<h3>Frequently asked question?</h3>
<p>Answer.</p>`,
  },
  {
    id: "listicle",
    label: "Listicle (Top N …)",
    description: "Ranked roundup (e.g. Top payment processors for high-risk merchants).",
    starterHtml: `<p>Intro: what this list covers and how you ranked the options (criteria: fees, payment methods, support).</p>
<h2>1. [Processor name]</h2>
<p><strong>Best for:</strong> … &nbsp; <strong>Pricing:</strong> …</p>
<p>Why it makes the list.</p>
<h2>2. [Processor name]</h2>
<p><strong>Best for:</strong> … &nbsp; <strong>Pricing:</strong> …</p>
<p>…</p>
<h2>3. [Processor name]</h2>
<p>…</p>
<h2>How to choose</h2>
<p>Guidance based on monthly volume, industry, and budget.</p>`,
  },
  {
    id: "comparison",
    label: "Comparison (X vs Y)",
    description: "Head-to-head of two processors or methods (e.g. Stripe vs PayPal).",
    starterHtml: `<p>Intro: who should read this comparison and the verdict in one line.</p>
<h2>[Processor A] vs [Processor B] at a glance</h2>
<p>One-paragraph summary of the key differences.</p>
<h2>Pricing &amp; fees</h2>
<p>Compare transaction rates, monthly fees, and any hidden costs.</p>
<h2>Features</h2>
<p>Payment methods, integrations, and payout speed.</p>
<h2>Support &amp; reliability</h2>
<p>…</p>
<h2>Verdict: which should you choose?</h2>
<p>Recommendation by use case.</p>`,
  },
  {
    id: "review",
    label: "Product / Service Review",
    description: "In-depth review of a single processor or gateway.",
    starterHtml: `<p>Intro: a one-line verdict and who this processor is best for.</p>
<h2>Overview</h2>
<p>What it is and how it positions itself.</p>
<h2>Pricing</h2>
<p>Transaction rates, monthly fees, and contract terms.</p>
<h2>Pros and cons</h2>
<p><strong>Pros</strong></p>
<ul><li>…</li></ul>
<p><strong>Cons</strong></p>
<ul><li>…</li></ul>
<h2>Who it's best for</h2>
<p>…</p>
<h2>Verdict</h2>
<p>Final recommendation.</p>`,
  },
  {
    id: "news",
    label: "News / Update",
    description: "Timely update on a processor, fee change, or industry regulation.",
    starterHtml: `<p>Lead: what changed, when, and why it matters for merchants — in the first two sentences.</p>
<h2>What changed</h2>
<p>The update in plain terms.</p>
<h2>Why it matters for merchants</h2>
<p>Impact on fees, compliance, or day-to-day operations.</p>
<h2>What to do next</h2>
<p>Concrete steps readers should take.</p>`,
  },
  {
    id: "generic",
    label: "Generic Article",
    description: "A flexible structure for any topic.",
    starterHtml: `<p>Open with a direct answer to the reader's question (answer-first).</p>
<h2>Section heading</h2>
<p>Supporting detail.</p>
<h2>Section heading</h2>
<p>Supporting detail.</p>
<h2>Conclusion</h2>
<p>Wrap up with the key takeaway and a next step.</p>`,
  },
];

const TEMPLATE_MAP = new Map(SEO_TEMPLATES.map((t) => [t.id, t]));

export function getSeoTemplate(id: BlogTemplate): SeoTemplate | undefined {
  return TEMPLATE_MAP.get(id);
}
