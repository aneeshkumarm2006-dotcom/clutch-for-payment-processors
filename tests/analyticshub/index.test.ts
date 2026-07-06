/**
 * Aggregator entry for the analyticshub test suite. node:test auto-runs every
 * registered test when this file is executed (`npm test` → `tsx <this file>`),
 * and sets a non-zero exit code if any fail. Cross-platform: no shell globbing.
 */
import "./crypto.test";
import "./session.test";
import "./handler.test";
