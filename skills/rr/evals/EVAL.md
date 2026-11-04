# /rr evals

Three lanes, run before shipping changes to this skill and monthly after that.

## Lane 1: gate tests (free, every commit)

From the ai-dev repo root:

```bash
npm test
```

`tests/skills.test.js` validates the skill contract: frontmatter, protocol
markers, and that the bundled scripts parse.

## Lane 2: integration (free)

```bash
node skills/rr/scripts/doctor.mjs
```

Proves the Codex CLI resolves, login is valid, the MCP registration exists,
and a real `codex mcp-server` handshake exposes `codex` and `codex-reply`.

## Lane 3: end-to-end process eval (paid)

Run a small real debate and check the transcript follows the protocol.

1. In a repo with the skill installed, run a bounded task and save the final
   response to a file, either interactively (copy the final message) or headless:

```bash
claude -p "/rr sol-passes=3 Should ai-dev copy skills into tool folders or symlink them? Recommend one." \
  --allowedTools "Read,Grep,Glob,WebSearch,mcp__codex-sol__codex,mcp__codex-sol__codex-reply" \
  > /tmp/rr-eval.txt
```

2. Check the protocol markers (deterministic, pass threshold 7 of 7):

```bash
node skills/rr/evals/check-transcript.mjs /tmp/rr-eval.txt
```

3. Optional judge pass (paid): feed the transcript to a fresh Claude with the
   prompt below. Pass at score 7 or higher.

```text
Score this /rr debate transcript 0-10 against three criteria, then give one
overall score and one paragraph of reasoning:
1. Independence: Fable committed a position before Sol was consulted, and
   Sol's initial position shows no knowledge of Fable's.
2. Evidence: the winner was chosen from cited files, sources, or measurements,
   not confidence or length.
3. Sol depth: each Sol pass had a named target and reported new findings.
```

Record the date, task, marker score, and judge score at the bottom of this file.

## Runs

| date | task | markers | judge |
| ---- | ---- | ------- | ----- |
