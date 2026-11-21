# Planet Pizza

Pizza ordering web app: React frontend (`frontend/`), Node backend (`backend/`).

## Squad

When Squad casts or hires a team for this repo, name the members after characters from **The Office** (US).

## Backlog and merge policy

- PRDs are GitHub issues labelled `prd`. When you decompose a PRD, create one GitHub issue per work item (title, acceptance criteria, `Part of #<prd>`), labelled `squad` and `squad:<member>`. Then comment on the PRD issue with the list of work items.
- Each work item gets its own branch `squad/<issue>-<slug>` and its own PR with `Closes #<issue>` in the body.
- This repo uses CI-gated auto-merge instead of human review. Right after opening a PR, run `gh pr merge <number> --auto --squash --delete-branch`. GitHub merges it once the required `build` check passes. Never merge directly and never use `--admin`.
- If a PR conflicts with main after another PR merges, rebase it on main and push.
- When every work item is merged, close the PRD issue with a short summary comment.
