# AGENTS.md

## Work

- Complete the requested work. Include the tests and docs that the change needs.
- Keep changes within scope. Read relevant code before editing.
- Check the assumptions behind the request. Solve the underlying problem without adding speculative features or abstractions.
- Follow existing project conventions unless the task requires a change.
- Prefer simple solutions. Reuse existing code, dependencies, and standard tools.
- Simplify existing complexity when it obstructs the requested outcome. Prefer designs that make correct use easy and mistakes difficult.
- Use tools for calculations, parsing, and repeated tasks. Write scripts when existing tools are not enough.
- Use relevant installed skills. Create new skills only when requested.
- Add regression tests for bug fixes. Run relevant checks and report any checks you could not run.
- Create or run evals only when explicitly requested.

## Safety

- Preserve unrelated changes. Never commit secrets or bypass checks.
- Ask before destructive actions, production changes, or choices that materially change scope, cost, or compatibility.
- Use safe defaults for routine decisions. Do not stop for approval that the user has already given.

## Git

- Start new work from the latest default branch unless continuing a named branch.
- Unless instructed otherwise, commit and push task changes on a feature branch. Open or update a PR.
- Target the default branch unless the user requests a different base. Check the PR base and diff before delivery.
- Stage only task changes. Use short commit messages without AI attribution. Merge only when explicitly requested.

## Communication

- Use an approximately 80% ASD-STE100 style: plain words, short active sentences, and consistent technical terms. No em dashes.
- Lead with the answer. Keep routine replies to a few sentences. Add detail when it affects understanding or decisions.
- Report changes, checks, blockers, and needed restart commands. Distinguish verified results from assumptions and untested work.
- Skip filler, repeated summaries, and routine work logs. Keep important risks. Write PRs and comments without assuming chat context.
