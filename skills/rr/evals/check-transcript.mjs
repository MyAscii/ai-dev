#!/usr/bin/env node
// Deterministic process eval for /rr transcripts: verifies the debate
// followed the protocol by checking its required section markers.
//
// Usage: node check-transcript.mjs <transcript-file>
// Exit 0 when all markers are present.

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node check-transcript.mjs <transcript-file>");
  process.exit(2);
}

const text = readFileSync(file, "utf8");

const markers = [
  ["FABLE INITIAL POSITION", /fable initial position/i],
  ["SOL INITIAL POSITION", /sol initial position/i],
  ["PASS A (repository depth)", /\bpass\s+a\b/i],
  ["PASS B (external evidence)", /\bpass\s+b\b/i],
  ["PASS C (falsification)", /\bpass\s+c\b/i],
  ["DECISION TABLE", /decision table/i],
  ["WINNER", /\bwinner\b/i],
];

let missing = 0;
for (const [label, pattern] of markers) {
  const found = pattern.test(text);
  console.log(`${found ? "PASS" : "FAIL"} ${label}`);
  if (!found) missing += 1;
}

const passed = markers.length - missing;
console.log(`markers: ${passed}/${markers.length}`);
process.exit(missing === 0 ? 0 : 1);
