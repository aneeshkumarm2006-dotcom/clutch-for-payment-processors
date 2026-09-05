/**
 * Aggregator for batch four's arithmetic tests, one suite per tool.
 *
 * Same discipline as `tests/tools/tools-math.test.ts`, and for the same reason:
 * every failure mode in a published calculator is SILENT. An amortisation
 * schedule whose final balance is eleven cents off looks right. A factoring APR
 * annualised on the invoice face value instead of the advanced amount is wrong
 * by a fifth and entirely plausible. An APY converted with the wrong compounding
 * period differs in the third decimal. None of them throw.
 *
 * Every reference value in these files must be derived INDEPENDENTLY of the
 * implementation: by hand, from a published worked example, or from a closed
 * form computed separately. A test that asserts what the code happens to return
 * pins the bug in place.
 *
 * Registered in `tests/index.test.ts`, so `npm test` runs them.
 */

import "./batch-four/shopify-payments-fee-calculator.test";
import "./batch-four/clover-fee-calculator.test";
import "./batch-four/toast-fee-calculator.test";
import "./batch-four/helcim-fee-calculator.test";
import "./batch-four/adyen-fee-calculator.test";
import "./batch-four/braintree-fee-calculator.test";
import "./batch-four/authorize-net-fee-calculator.test";
import "./batch-four/venmo-cash-app-zelle-business-fee-calculator.test";
import "./batch-four/interchange-fee-lookup.test";
import "./batch-four/interchange-downgrade-calculator.test";
import "./batch-four/chargeback-cost-calculator.test";
import "./batch-four/refund-cost-calculator.test";
import "./batch-four/cross-border-fee-calculator.test";
import "./batch-four/credit-card-processing-savings-calculator.test";
import "./batch-four/merchant-account-junk-fee-calculator.test";
import "./batch-four/pci-saq-level-finder.test";
import "./batch-four/bnpl-fee-calculator.test";
import "./batch-four/false-decline-cost-calculator.test";
import "./batch-four/high-risk-merchant-account-cost-calculator.test";
import "./batch-four/apr-vs-apy-calculator.test";
import "./batch-four/business-loan-amortization-calculator.test";
import "./batch-four/invoice-factoring-calculator.test";
import "./batch-four/early-payment-discount-calculator.test";
import "./batch-four/cash-conversion-cycle-calculator.test";
import "./batch-four/break-even-and-margin-calculator.test";
