# AI Log — Commit message on publish

- **Tool:** Claude Code (Sonnet 5)
- **Date:** 2026-09-16
- **Issue:** #16 — "Prompt for a commit style message when publishing a doc"
- **Summary:** As a user, I want to be prompted for a short commit-style message explaining what changed and why when I publish a document, so that document history captures reasoning, not just content diffs.

## Prompts given

1. "Look into the Outline repo" (initial orientation request, answered via clarifying question — user selected the specific issue below to work on).
2. "I want to work on this issue: Prompt for a commit style message when publishing a doc #16 ... [full issue text pasted]"
3. Answered design-decision questions (see below) with: "I want it to be like a pop-up message that will save somewhere, almost like a git commit message" / "I want it to come up with a commit message that saves somewhere, like a git commit" / "Both paths (Recommended)".

## Research performed

Delegated a research pass (subagent) to trace the document publish flow end-to-end before writing any code:

- Frontend publish entry point: `publishDocument` action in `app/actions/definitions/documents.tsx`, and the existing `app/scenes/DocumentPublish.tsx` dialog.
- Backend: `documents.update` API route → `documentUpdater` command → `Document.publish()` model method → async `documents.publish` event → `RevisionsProcessor` queue processor → `revisionCreator` command → `Revision.createFromDocument`.
- Discovered `Revision` already has an unused `name: string | null` column (added by a prior migration, already wired through the presenter and the frontend model) that was a natural fit for storing the message without a new migration.

## Design decisions (clarified with user via questions)

- Reuse the existing unused `Revision.name` column instead of adding a new migration — no schema change needed.
- Message is required before publishing (mirrors git's requirement of a commit message), not optional.
- The prompt applies to both publish paths: publishing to a brand-new location (no collection yet) and republishing a document that already has a collection assigned.

## Implementation

- `app/scenes/DocumentPublish.tsx` — added a required message textarea; skips the location picker when the document already has a destination collection.
- `app/actions/definitions/documents.tsx` — `publishDocument.perform` now always opens the publish dialog (previously it published directly without a dialog when a collection was already set).
- `app/models/Document.ts` — added `message` to `SaveOptions`.
- `server/routes/api/documents/schema.ts` — added optional `message` field (validated against `RevisionValidation.maxNameLength`) to `DocumentsUpdateSchema`.
- `server/commands/documentUpdater.ts` — threads `message` into the publish event's `data` payload.
- `server/types.ts` — added `message?: string` to the relevant `DocumentEvent` data shapes.
- `server/queues/processors/RevisionsProcessor.ts` — extracts `message` from the event and passes it to `revisionCreator`.
- `server/commands/revisionCreator.ts` — accepts `message` and forwards it to `Revision.createFromDocument`.
- `server/models/Revision.ts` — `createFromDocument` sets `revision.name` when a message is supplied.
- `app/scenes/Document/components/History/RevisionListItem.tsx` — renders the message under each revision's metadata in the document history sidebar.

## Testing / verification

- `yarn tsc --noEmit -p .` — passed across the whole project.
- `yarn oxlint --type-aware` and `yarn oxfmt --check` on all touched files — clean.
- Added two new backend tests:
  - `server/commands/documentUpdater.test.ts` — asserts the publish event's `data` carries the message.
  - `server/commands/revisionCreator.test.ts` — asserts the created revision's `name` field is set from the message.
- Had to create and migrate the local `outline-test` database (`yarn sequelize db:create` + `yarn db:migrate` under `NODE_ENV=test`) since it didn't exist yet in this environment.
- Ran the two affected test files: 41 tests passed, including the 2 new ones.

## Outcome

Feature implemented and passing typecheck/lint/tests. Not yet committed to git (left as a working-tree diff pending user's decision on commit/PR). No frontend component tests were added for `DocumentPublish.tsx` since there was no existing test pattern for that scene to follow, and no browser click-through was performed for this issue specifically (browser verification was done for the companion Enter-to-submit-comment issue, see the other log).
