---
name: rr
description: Run a two-expert research and review debate between the local Claude session (Fable, the chair) and OpenAI Codex (Sol) over the codex-sol MCP server. Both experts investigate independently, propose their own solution, critique each other, and settle disagreements with evidence; Sol runs many cheap deep-research passes. Use only when the user explicitly invokes /rr with a task or question.
disable-model-invocation: true
argument-hint: <task or question> [sol-passes=N]
---

# /rr: Research and Review Debate

Task: $ARGUMENTS

If the task above is empty, ask the user what to debate and stop.
If the task contains `sol-passes=N`, use N as the Sol pass cap (default 8) and strip that token from the task text.

## Roles

- **Fable**: this Claude session. Independent expert and chair.
- **Sol**: the Codex CLI model (default set in `~/.codex/config.toml`, currently `gpt-5.6-sol`), reached through the MCP tools `codex` (starts a thread) and `codex-reply` (continues a thread via its `threadId`) on the `codex-sol` server. Any connected server exposing these two tools works.

Sol usage is cheap, Fable usage is not. Spend Sol freely on depth: repeated repository passes, literature searches, falsification, reviews. Spend Fable on its own position, critique, arbitration, and the final call. Extra Sol calls buy depth, never extra voting weight.

## Preconditions

1. Confirm the `codex` and `codex-reply` MCP tools are available.
2. If they are missing, run `node scripts/doctor.mjs` from this skill's directory, show the user its output and the fix it prints (see SETUP.md), and stop with status BLOCKED. Never run the debate as Fable alone.

## Rules for every Sol call

- `sandbox: "read-only"` and `approval-policy: "never"` for all research and review. Sol never writes files.
- `cwd`: absolute path of the project root.
- Continue one line of investigation with `codex-reply` and its `threadId`. Start a new `codex` thread only for a genuinely fresh perspective (initial position, final review).
- Require exact file paths with line references, source citations (title, year, DOI or URL), and a confirmed-versus-inferred label on each claim.
- When external evidence matters, tell Sol to use its web search tool.

## Independence rule (non-negotiable)

Fable writes and commits its own position before the first Sol call. Sol produces its initial position without seeing any of Fable's thinking. Neither initial position may borrow from the other. Both experts must be able to win.

## Phase 1: Frame the decision

Briefly state: the exact problem, success criteria, constraints, assumptions that could change the answer, and what evidence would decide it. Do not solve anything yet. If the task is ambiguous but actionable, state your assumptions and continue.

## Phase 2: FABLE INITIAL POSITION

Investigate directly: read the relevant repository files, trace the important paths, search the web for primary sources when the topic needs them. Then write a section titled exactly `FABLE INITIAL POSITION` containing: recommendation, supporting evidence, alternatives considered, risks and edge cases, what would disprove it, remaining uncertainty. This position is now committed. Do not send it to Sol yet.

## Phase 3: SOL INITIAL POSITION

Start a new `codex` thread. Provide: the original task verbatim, the Phase 1 framing, the project root, and the call rules above. Do not include anything from Phase 2. Ask Sol for a section titled exactly `SOL INITIAL POSITION` with the same structure plus at least one credible alternative it rejected.

## Phase 4: Sol deep-research passes

Use `codex-reply` on Sol's thread. One named target per pass; Sol reports only new findings and whether they change its position. For a substantive task always run:

- **PASS A, repository depth**: trace callers and callees, data flow, parallel implementations, tests, fixtures, config, migrations, error handling. Look for behavior that contradicts its assumptions.
- **PASS B, external evidence**: primary papers and official docs, follow citations from the strongest sources, find newer and disagreeing sources, weigh method, recency, and applicability.
- **PASS C, falsification**: build the strongest case against its own recommendation, hunt counterexamples and hidden assumptions, name the conditions where it fails, propose the test that would settle it. Revise the recommendation when warranted.

Keep running focused passes while material new evidence keeps appearing. Stop when two consecutive passes add nothing material, or at the pass cap. Every pass needs a named target; no filler calls.

## Phase 5: Fable deepening

Take the uncertainty list from Phase 2 and close the biggest gaps with your own focused checks (repository or web). Update the Fable position and list every change as "changed: X because Y". Do not copy Sol's conclusions here; this pass is Fable's own work on Fable's own gaps.

## Phase 6: Exchange and mutual review

Fable reviews Sol's full position: strongest discoveries, unsupported claims, missed evidence or code paths, misreadings, parts worth adopting, and honest reasons Sol might be right where they disagree.

Then send Sol, via `codex-reply`: Fable's full position and Fable's critique of Sol. Require Sol to answer the strongest opposing arguments directly, admit concrete errors, and produce a revised recommendation.

## Phase 7: Resolve disagreements with evidence

List the remaining substantive disagreements. For each one: state both positions fairly, name the evidence that would settle it, run a focused Fable check and a focused Sol pass, and run safe tests, minimal reproductions, or benchmarks when the question is executable. Measured evidence beats argument. Keep measurements separate from opinions in the write-up.

## Phase 8: DECISION TABLE and winner

Produce a section titled exactly `DECISION TABLE` scoring both final positions on: correctness, evidence quality, repository understanding, source quality, handling of contradicting evidence, simplicity, maintainability, security and reliability, testability, performance, remaining uncertainty. Then a line starting `WINNER:` naming one outcome: Fable's solution, Sol's solution, a precisely specified hybrid, or "more evidence required". Pick by evidence, never by confidence, length, model identity, or call count. Explain why the winner won, why each loser lost, and which ideas from losing positions survive into the final answer.

## Phase 9: Implementation (only when the task asks for it)

No file edits before this phase, ever. Write a short plan: files, exact behavior changes, tests to add, verification commands, rollback, risks. Fable writes the code unless the user explicitly named Sol as the writer. Keep changes scoped, follow repository conventions, add tests, then run formatting, linting, type checks, and the relevant test suites.

## Phase 10: Independent review

Start a fresh `codex` thread (read-only) that saw none of the debate. Give it: the task, acceptance criteria, the chosen design, the full git diff, and test results. Require findings with severity, evidence, file and line, proposed fix, and a blocking flag. Fable reviews the diff independently as well. Verify every finding before accepting it, fix the valid ones, rerun verification, and use extra Sol review passes when a finding points at unexplored paths.

## Final report

End with: the task and assumptions; both initial positions, condensed; each Sol pass and what it added; the key sources; the mutual critiques; how each position changed; the DECISION TABLE; the winner and why; implementation and verification results when applicable; remaining risks; and what further evidence would raise confidence.
