# AI Log — Mark as reviewed action on documents

- **Tool:** Claude Code (Opus 5.5)
- **Date:** 2026-10-29
- **Issue:** #61 — "Add mark as reviewed action on documents" (part of the stale docs features, #17)
- **Summary:** As a document owner, I want to mark a document as reviewed so that I can confirm it is still accurate without making unnecessary edits.

## Prompts given

1. "help me start a new issue" with the text of issue #61 pasted in. Claude checked the existing stale-document code and teammates' branches, created the branch `feat/issue-61-Add-mark-as-reviewed-action-on-documents` from the latest `main`, and proposed a plan.
2. "yes" — approved the plan and the recommended answers to the issue's open questions.
3. "i need to checkout a new branch for this issue as well" — Claude confirmed the branch from step 1 was already checked out.
4. "tests look good" — I reviewed the tests.
5. "git add and commit", then `git push -u origin feat/issue-61-Add-mark-as-reviewed-action-on-documents`.
6. "add ai log" — this file.

## Research performed

- **Existing stale flag (on `main`):** `shared/utils/isStale.ts` (180-day threshold), `Document.isStale` in the client model, the sidebar badge in `DocumentLink.tsx`, and `lastEditedAt` on documents and in the collection structure (`NavigationNode`).
- **Teammates' branches that overlap:**
  - `feat/issue-62-configurable-staleness-threshold` (Mustafa, not merged) changes the `isStale()` signature to take a threshold.
  - `feat-review-workflow-1` (TheOneWhoWished, not merged) adds `reviewStatus`, `reviewerId` and `reviewRequestedById` for a request/approve review workflow. This is a different feature; approval chains are out of scope for #61.
- **How a similar action works end to end:** read `documents.archive` (route, schema, `archiveWithCtx`, policy, presenter, store action, menu action).
- **How events are recorded:** `saveWithCtx(ctx, options, { name })` writes a `documents.<name>` event automatically.
- **Where history comes from:** the history panel only fetches the event types listed in `History.tsx`, and `events.list` only allows names in `EventHelper.ACTIVITY_EVENTS`.
- **How changes reach other users:** `WebsocketsProcessor` and the client's `WebsocketProvider`.
- **Revisions:** a revision is only created for content edits, and a `silent` save doesn't change `updatedAt`.

## Design decisions

- **New fields:** `reviewedAt` and `reviewedById` on documents, separate from the review-workflow fields to avoid name collisions.
- **No fake edit:** the review is saved with `silent: true` and a `review` event name, so it doesn't create a revision or change `updatedAt` or `lastEditedAt`.
- **Staleness:** measured from the later of the last edit and the last review. This logic is in a new `shared/utils/getStalenessDate.ts`, and `isStale()` is unchanged, to avoid a merge conflict with #62.
- **Sidebar:** `reviewedAt` is stored in the collection structure, so the badge clears even when the document isn't loaded. A review always refreshes the structure.
- **Live updates:** other viewers receive the review as a `documents.update` socket message, which the client already handles.
- **Permissions:** a new `review` policy requires a published document the user can `update`. That rules out viewers, other teams, drafts, and archived or deleted documents.
- **Answers to the issue's open questions (approved by me):**
  - Show `reviewedAt` in the document meta: yes, as "Reviewed <time>", but only when the review is newer than the last edit.
  - A log of who reviewed and when: yes, through `documents.review` events in the document history. `reviewedById` also stores the most recent reviewer.
- **Webhooks:** TypeScript required the new event to be handled in the webhook delivery task, so `documents.review` was added to the webhook document events and subscription form.

## Implementation

- `server/migrations/20261029000000-add-reviewed-at-to-documents.js` — adds `reviewedAt` and `reviewedById` (a link to `users`, cleared if the user is deleted).
- `server/models/Document.ts` — the new columns, `reviewWithCtx`, structure refresh on review, `reviewedAt` in `toNavigationNode`.
- `server/routes/api/documents/documents.ts`, `schema.ts` — the `documents.review` endpoint.
- `server/policies/document.ts` — the `review` ability.
- `server/presenters/document.ts` — returns `reviewedAt` and `reviewedById` (hidden on public shares, like `lastEditedAt`).
- `server/types.ts`, `shared/utils/EventHelper.ts` — the `documents.review` event type, allowed in activity and audit events.
- `server/queues/processors/WebsocketsProcessor.ts` — sends the review to other viewers.
- `shared/types.ts`, `shared/utils/getStalenessDate.ts` — `reviewedAt` on `NavigationNode`, and the staleness date helper.
- `app/models/Document.ts`, `app/models/Collection.ts`, `app/stores/DocumentsStore.ts` — `reviewedAt`, `isStale` using the helper, `isReviewedSinceEdit`, the `review()` action, and the sidebar node update.
- `app/actions/definitions/documents.tsx`, `app/hooks/useDocumentMenuAction.tsx` — the "Mark as reviewed" menu action.
- `app/components/Sidebar/components/DocumentLink.tsx` — the sidebar badge uses the review date.
- `app/scenes/Document/components/History/*` — "<user> marked as reviewed" in the history panel.
- `app/components/DocumentMeta.tsx` — "Reviewed <time>" in the document meta.
- `plugins/webhooks/*` — webhook support for the new event.
- `shared/i18n/locales/en_US/translation.json` — extracted with the project's `i18next` script, which also reordered a few existing strings without changing them.

## Testing

- `server/routes/api/documents/documents.test.ts` — 10 new tests for `documents.review`:
  - errors: requires `id` (400) and authentication (401)
  - sets `reviewedAt` and `reviewedById`
  - doesn't create a revision or change `updatedAt`, `lastEditedAt` or the text
  - records a `documents.review` event that `events.list` returns
  - stores `reviewedAt` in the collection structure
  - returns 403 for viewers, other teams, drafts and archived documents
- `shared/utils/getStalenessDate.test.ts` — later-of logic, ISO strings, staleness clearing after a review and returning once the review is old.
- `app/test/Document.test.ts` — `isStale` with reviews (including updating a loaded document), and `isReviewedSinceEdit`.
- Claude started my local Docker Postgres and Redis containers and ran the migration on the test database only.
- The four related existing suites (documents API, events API, document policies, document model) passed: 376 tests. The client `Document` tests passed. `yarn tsc` and oxlint were clean.
- Tested by hand in the browser after running `yarn db:migrate` on the dev database.
