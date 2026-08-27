# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create an issue with `gh issue create`.
- Read an issue with `gh issue view <number> --comments` and include labels.
- List issues with `gh issue list` and use structured JSON output when a skill must filter results.
- Comment with `gh issue comment <number>`.
- Add or remove labels with `gh issue edit <number>`.
- Close an issue with `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`. The `gh` CLI does this automatically inside this clone.

## Pull requests as a triage surface

External pull requests are not a request surface. Do not mix them into the issue triage queue.

GitHub uses one number space for issues and pull requests. If a reference is not clear, try `gh pr view <number>` and then `gh issue view <number>`.

## Skill terms

- When a skill says "publish to the issue tracker," create a GitHub issue.
- When a skill says "fetch the relevant ticket," run `gh issue view <number> --comments`.
