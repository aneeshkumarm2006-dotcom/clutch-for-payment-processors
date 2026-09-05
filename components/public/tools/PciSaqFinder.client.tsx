"use client";

import * as React from "react";
import type { PciSaqQuestion, PciSaqType } from "@/lib/tools-data/pci";
import { PCI_MERCHANT_LEVELS, PCI_SAQ_DEFAULTS } from "@/lib/tools-data/pci";
import { merchantLevel, reachableQuestions, resolveSaq } from "@/lib/calc/pci";
import {
  CalcShell,
  Callout,
  Caveat,
  CheckboxRow,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ModeTabs,
  Pill,
  ResultRow,
  SelectField,
  num,
} from "@/components/public/tools/ToolKit";

/**
 * PCI SAQ Level Finder.
 *
 * Two answers on one page, kept apart on purpose. MERCHANT LEVEL is a card
 * network classification set by annual transaction count and decides how you
 * validate. SAQ TYPE is a PCI SSC classification set by how you accept payments
 * and decides which questionnaire you fill in. Every page that merges them ends
 * up telling a small merchant that being Level 4 answers the question, which it
 * does not.
 *
 * The questionnaire tree and the SAQ descriptions arrive as PROPS from the
 * server component rather than being imported here, for the reason in
 * `ToolWidget`: one route serves every calculator, so an import would ship this
 * dataset to the Stripe fee page as well. The defaults and the four level bands
 * are small enough to import directly.
 *
 * NO VERDICT BAND HERE. The shared `Verdict` primitive scores a blended monthly
 * effective rate. There is no such thing on this page, and a colored "Good" or
 * "High" beside a compliance answer would read as a determination, which is
 * exactly what this tool must not produce.
 */
export function PciSaqFinder({
  questions,
  types,
}: {
  questions: PciSaqQuestion[];
  types: PciSaqType[];
}) {
  const [mode, setMode] = React.useState<"saq" | "level" | "types">(PCI_SAQ_DEFAULTS.mode);
  const [answers, setAnswers] = React.useState<Record<string, string>>({ ...PCI_SAQ_DEFAULTS.answers });
  const [totalTxns, setTotalTxns] = React.useState(String(PCI_SAQ_DEFAULTS.totalAnnualTransactions));
  const [ecomTxns, setEcomTxns] = React.useState(String(PCI_SAQ_DEFAULTS.ecommerceAnnualTransactions));
  const [compromise, setCompromise] = React.useState(PCI_SAQ_DEFAULTS.hadCompromise);

  const allIds = React.useMemo(() => types.map((t) => t.id), [types]);
  const asked = React.useMemo(() => reachableQuestions(questions, answers), [questions, answers]);
  const result = React.useMemo(() => resolveSaq(questions, answers, allIds), [questions, answers, allIds]);

  const chosen = result.saqId ? types.find((t) => t.id === result.saqId) : undefined;

  const level = React.useMemo(
    () =>
      merchantLevel(
        {
          totalAnnualTransactions: num(totalTxns),
          ecommerceAnnualTransactions: num(ecomTxns),
          hadCompromise: compromise,
        },
        PCI_MERCHANT_LEVELS,
      ),
    [totalTxns, ecomTxns, compromise],
  );

  /**
   * Changing an earlier answer drops the answers below it. Keeping them would
   * leave a stale reply to a question the tree no longer asks, and the resolver
   * would happily walk past it.
   */
  const answer = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const path = reachableQuestions(questions, prev).map((q) => q.id);
      const at = path.indexOf(questionId);
      const kept: Record<string, string> = {};
      path.slice(0, at < 0 ? path.length : at).forEach((id) => {
        if (prev[id]) kept[id] = prev[id];
      });
      kept[questionId] = optionId;
      return kept;
    });
  };

  const SCAN_LABEL: Record<PciSaqType["scan"], string> = {
    yes: "Quarterly ASV scan",
    conditional: "Scan if in scope",
    no: "No ASV scan",
    unverified: "Not verified here",
  };

  const scanPill = (t: PciSaqType) => (
    <Pill tone={t.scan === "yes" ? "warn" : t.scan === "no" ? "good" : "neutral"}>{SCAN_LABEL[t.scan]}</Pill>
  );

  const controls =
    mode === "saq" ? (
      <div className="space-y-5">
        <ModeTabs
          value={mode}
          onChange={(v) => setMode(v as "saq" | "level" | "types")}
          options={[
            { value: "saq", label: "Which SAQ?" },
            { value: "level", label: "Merchant level" },
            { value: "types", label: "All SAQ types" },
          ]}
        />
        <div className="space-y-4">
          {asked.map((q, i) => (
            <SelectField
              key={q.id}
              id={`pci-q-${q.id}`}
              label={`${i + 1}. ${q.question}`}
              hint={q.help}
              value={answers[q.id] ?? ""}
              onChange={(v) => answer(q.id, v)}
              options={[
                ...(answers[q.id] ? [] : [{ value: "", label: "Choose one" }]),
                ...q.options.map((o) => ({ value: o.id, label: o.label })),
              ]}
            />
          ))}
        </div>
        {(() => {
          const last = asked[asked.length - 1];
          if (!last) return null;
          const picked = last.options.find((o) => o.id === answers[last.id]);
          return picked?.hint ? (
            <p className="rounded border border-border-strong bg-muted px-4 py-3 text-small text-muted-foreground">
              {picked.hint}
            </p>
          ) : null;
        })()}
        <p className="text-micro text-muted-foreground">
          One SAQ covers one payment channel. If you sell online and in person, run this twice.
        </p>
      </div>
    ) : mode === "level" ? (
      <div className="space-y-5">
        <ModeTabs
          value={mode}
          onChange={(v) => setMode(v as "saq" | "level" | "types")}
          options={[
            { value: "saq", label: "Which SAQ?" },
            { value: "level", label: "Merchant level" },
            { value: "types", label: "All SAQ types" },
          ]}
        />
        <FieldGrid>
          <Field
            id="pci-total"
            label="Visa and Mastercard transactions a year"
            value={totalTxns}
            onChange={setTotalTxns}
            inputMode="numeric"
            hint="All channels, counted per card brand. Use your largest brand."
          />
          <Field
            id="pci-ecom"
            label="Of those, e-commerce transactions"
            value={ecomTxns}
            onChange={setEcomTxns}
            inputMode="numeric"
            hint="Online only. This is the one count that separates Level 3 from Level 4."
          />
        </FieldGrid>
        <div className="rounded border bg-muted px-4 py-3">
          <CheckboxRow
            checked={compromise}
            onChange={() => setCompromise((v) => !v)}
            label="We have had a confirmed account data compromise"
            hint="The networks may escalate a breached merchant regardless of volume."
          />
        </div>
        <p className="text-micro text-muted-foreground">
          Levels are per card brand. A merchant can be Level 2 at one network and Level 4 at another, and the
          strictest one wins in practice because the acquirer applies one program to the account.
        </p>
      </div>
    ) : (
      <div className="space-y-5">
        <ModeTabs
          value={mode}
          onChange={(v) => setMode(v as "saq" | "level" | "types")}
          options={[
            { value: "saq", label: "Which SAQ?" },
            { value: "level", label: "Merchant level" },
            { value: "types", label: "All SAQ types" },
          ]}
        />
        <p className="text-small text-muted-foreground">
          Every self-assessment questionnaire in PCI DSS v4.0.1, with the channels it may be used for, how many
          of the twelve PCI DSS requirement families its Section 2 asks about, and whether it carries Requirement
          11.3.2, the quarterly external scan by an Approved Scanning Vendor.
        </p>
        <p className="text-micro text-muted-foreground">
          The family counts were read off the published questionnaires. The PCI SSC publishes an item count for SAQ
          A and SAQ A-EP only, so no other item count appears anywhere on this page.
        </p>
      </div>
    );

  const results =
    mode === "saq" ? (
      <div>
        <Headline
          label={result.complete ? "Likely questionnaire" : "Keep going"}
          value={chosen ? chosen.label : "Not yet"}
          sub={
            chosen
              ? chosen.title
              : `Answer question ${result.path.length + 1} to narrow this down. ${result.remaining.length} of ${allIds.length} questionnaires are still in play.`
          }
        />

        {chosen && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {scanPill(chosen)}
              <Pill tone="neutral">
                {chosen.requirementFamilies
                  ? `${chosen.requirementFamilies.length} of 12 requirement families`
                  : "Requirement families not counted"}
              </Pill>
              {chosen.requirementCount !== null && (
                <Pill tone="neutral">{chosen.requirementCount} published requirements</Pill>
              )}
            </div>

            <p className="mt-4 text-body text-muted-foreground">{chosen.whoItIsFor}</p>

            <div className="mt-5">
              <ResultRow label="Channels it covers" value={chosen.channels.join(", ")} />
              <ResultRow
                label="Requirement families in Section 2"
                value={chosen.requirementFamilies ? chosen.requirementFamilies.join(", ") : "Not verified here"}
                note="Of the twelve in PCI DSS"
              />
              <ResultRow
                label="Quarterly ASV scan"
                value={
                  chosen.scan === "yes"
                    ? "Yes"
                    : chosen.scan === "conditional"
                      ? "If systems are in scope"
                      : chosen.scan === "no"
                        ? "No"
                        : "Not verified here"
                }
                note="PCI DSS Requirement 11.3.2"
                emphasis
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Every criterion you must be able to confirm</p>
              <ul className="mt-2 space-y-2">
                {chosen.eligibility.map((c) => (
                  <li key={c} className="text-small text-muted-foreground">
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5">
              <p className="text-label uppercase text-muted-foreground">How the answers got here</p>
              <div className="mt-2">
                <MiniTable
                  columns={["You said", "Which means"]}
                  align={["left", "left"]}
                  rows={result.path.map((step) => [
                    <span key={step.questionId} className="text-muted-foreground">
                      {step.answer}
                    </span>,
                    <span key={`${step.questionId}-q`}>{step.question}</span>,
                  ])}
                />
              </div>
            </div>

            <Callout tone={chosen.id === "a-ep" ? "warn" : "neutral"}>
              {chosen.id === "a-ep"
                ? "This is the answer most online stores get wrong. If your own server delivers the checkout page, or your page loads a script that builds or submits it, SAQ A is not available to you and SAQ A-EP is. The gap between them is 29 requirements against 139."
                : chosen.id === "a"
                  ? "SAQ A merchants still carry Requirement 11.3.2 under PCI DSS v4.x, a quarterly external scan by an Approved Scanning Vendor, wherever they have systems in scope. That was not true under v3.2.1, and a lot of published guidance has not caught up."
                  : `${chosen.label} is the questionnaire your answers point at. Your acquirer confirms it before you start, and the eligibility list above is what you are attesting to.`}
            </Callout>

            <Caveat>
              This indicates a likely SAQ from the answers you gave. It is not a compliance determination. Your
              acquirer sets your obligations and a Qualified Security Assessor validates them.
            </Caveat>
          </>
        )}

        {!chosen && (
          <div className="mt-5">
            <p className="text-label uppercase text-muted-foreground">Still possible</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.remaining.map((id) => {
                const t = types.find((x) => x.id === id);
                return t ? (
                  <Pill key={id} tone="neutral">
                    {t.label}
                  </Pill>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    ) : mode === "level" ? (
      <div>
        <Headline
          label="Merchant level"
          value={level.label}
          sub={level.reason}
        />

        <div className="mt-5">
          <ResultRow label="How you validate" value={level.level === 1 ? "Report on Compliance" : "Self-assessment questionnaire"} emphasis />
          {level.toNextLevelTotal !== null && (
            <ResultRow
              // The total-volume figure climbs to Level 1 from Level 2, and to
              // Level 2 from Levels 3 and 4. It is never the Level 3 line: that
              // one is an e-commerce count and has its own row below.
              label={`Transactions to reach Level ${level.level === 2 ? 1 : 2}`}
              value={Math.max(0, level.toNextLevelTotal).toLocaleString("en-US")}
              note="Additional transactions across all channels"
            />
          )}
          {level.toNextLevelEcommerce !== null && (
            <ResultRow
              label="E-commerce transactions to reach Level 3"
              value={Math.max(0, level.toNextLevelEcommerce).toLocaleString("en-US")}
              note="Additional online transactions only"
            />
          )}
          {level.toLowerLevelEcommerce !== null && (
            <ResultRow
              label="E-commerce fall that would drop you to Level 4"
              value={Math.max(0, level.toLowerLevelEcommerce).toLocaleString("en-US")}
              note="How much of your online volume is holding Level 3 in place"
            />
          )}
        </div>

        <p className="mt-4 text-small text-muted-foreground">{level.validation}</p>

        <div className="mt-6">
          <p className="text-label uppercase text-muted-foreground">The four levels</p>
          <div className="mt-2">
            <MiniTable
              columns={["Level", "Visa", "Mastercard", ""]}
              align={["left", "left", "left", "right"]}
              maxHeight="320px"
              rows={PCI_MERCHANT_LEVELS.map((l) => [
                <span key={l.label} className="text-foreground">
                  {l.label}
                </span>,
                <span key={`${l.label}-v`} className="text-muted-foreground">
                  {l.visaCriteria}
                </span>,
                <span key={`${l.label}-m`} className="text-muted-foreground">
                  {l.mastercardCriteria}
                </span>,
                l.level === level.level ? (
                  <Pill key={`${l.label}-p`} tone="warn">
                    You
                  </Pill>
                ) : (
                  ""
                ),
              ])}
            />
          </div>
        </div>

        {level.clamped && (
          <Callout tone="warn">
            Your e-commerce figure was higher than your total, so it has been capped at the total. The second box is
            the online subset of the first, not a separate stack of transactions.
          </Callout>
        )}

        {level.onNetworkBoundary && (
          <Callout tone="warn">
            You are on exactly 20,000 e-commerce transactions, the one count where the two networks read
            differently. Mastercard says Level 3 begins above 20,000. Visa&rsquo;s page describes Level 3 as 20,000
            to 1 million and Level 4 as fewer than 20,000, which claims the same number for both. Ask your acquirer
            rather than picking the answer you prefer.
          </Callout>
        )}

        {level.escalatedByCompromise && (
          <Callout tone="warn">
            A confirmed account data compromise overrides the counts. Mastercard may deem any such merchant to be
            Level 1 at its sole discretion, and a forensic investigation usually arrives before the paperwork does.
          </Callout>
        )}

        <Caveat>
          Your acquirer assigns your level, applying these network definitions to your account. If you accept more
          than one brand, the strictest classification is the one you will be held to.
        </Caveat>
      </div>
    ) : (
      <div>
        <Headline
          label="Questionnaires"
          value={String(types.length)}
          sub={`Under PCI DSS v4.0.1: ${types.filter((t) => t.id !== "d-service-provider").length} a merchant can be eligible for, and one that service providers use.`}
        />
        <div className="mt-4">
          <MiniTable
            columns={["SAQ", "Channels", "Families", "ASV scan"]}
            align={["left", "left", "right", "right"]}
            maxHeight="460px"
            rows={types.map((t) => [
              <span key={t.id} className="text-foreground">
                {t.label}
                <span className="block text-micro text-muted-foreground">{t.whoItIsFor}</span>
              </span>,
              <span key={`${t.id}-c`} className="text-muted-foreground">
                {t.channels.join(", ")}
              </span>,
              <span key={`${t.id}-f`} className="tabular-nums">
                {t.requirementFamilies ? `${t.requirementFamilies.length} of 12` : "Not counted"}
              </span>,
              scanPill(t),
            ])}
          />
        </div>
        <Caveat>
          Requirement family counts are the number of the twelve PCI DSS requirement families that appear in Section
          2 of each published questionnaire. They are a measure of breadth, not of effort: SAQ C and SAQ A-EP both
          touch all twelve and are very different documents.
        </Caveat>
      </div>
    );

  return <CalcShell controls={controls} results={results} />;
}

export default PciSaqFinder;
