# Shared skill layout evaluation

Outcome: one physical project skill tree serves all four tool paths. A central
update reaches every tool, and migration preserves all prior tool directory data.

## Deterministic evaluation

Run `npm run eval` before shipping. Pass threshold: all six scenarios pass.
The runner uses real bundled skills, CLI processes, Windows junctions or Unix
symlinks, a repository with spaces in its path, and real `git check-ignore`.
It prints each result, a JSON score, and the temporary evidence directory.
Gate regressions live in `tests/cli.test.js` and run with `npm test`.

## Periodic agent evaluation

Before shipping and nightly, use local Claude Code with its best available model.
No hosted inference API. Give the reviewer this prompt plus the current diff and
deterministic evaluation output:

> Review the shared-skills installer. Trace fresh installation, legacy migration,
> repeated installation, local edits with and without force, foreign/dangling links,
> Windows junctions, Git ignore behavior, and state/status reporting. Inspect the
> implementation and tests. Check the process as well as results: were sources
> validated before mutation, old data preserved, and real filesystem/Git behavior
> tested? Return JSON with `pass`, `failures`, and evidence per scenario. Fail on
> any unhandled data-loss path or mismatch between documentation and behavior.

Pass threshold: `pass: true` and zero failures. Record the model, date, output and
deterministic score in the PR. If local Claude Code is unavailable, report that the
agent evaluation was not run; do not claim that lane passed.
