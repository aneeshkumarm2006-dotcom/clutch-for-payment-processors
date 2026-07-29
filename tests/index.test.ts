/**
 * Root aggregator for the whole suite. node:test auto-runs every registered test
 * when this file is executed (`npm test` → `tsx <this file>`) and sets a non-zero
 * exit code if any fail. Add new suites here so they can't be forgotten by CI.
 */
import "./analyticshub/index.test";
import "./homepage/homepage.test";
import "./reviews/reviews-page.test";
