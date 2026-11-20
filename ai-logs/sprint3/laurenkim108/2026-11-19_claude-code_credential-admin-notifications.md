# AI Log — Notify admins when a credential is detected in a document

- **Tool:** Claude Code (Opus 5.5)
- **Date:** 2026-11-19
- **Issue:** #65 — "Notify admins when a credential is detected in a document" (builds on #63, related to #64)
- **Summary:** As an admin, I want to be notified when a document is saved containing a potential credential so that I can follow up with the author and ensure it is removed.

## Prompts given

1. "help me start issue 65" — Claude read the issue and its comments from GitHub, the #63 pattern library, the open #64 branch and Outline's notification system, then proposed a plan.
2. Answered two questions from Claude: notify **all admins** (not just an "owner", since Outline has no owner field), and **create a branch and implement**. Claude created `feat/issue-65-credential-admin-notifications` from the latest `origin/main`, built the feature and tests, and started the repo's Postgres and Redis containers to run the server tests.
3. "Do i create a new doc or just edit an existing one" — Claude traced when the server saves a revision and explained how to test by hand: use a published doc, a credential that is new, two accounts, and "Done editing" to save right away.
4. "i got the notification" / "it works" — I tested it in the browser, including the preference toggle and that repeated saves don't notify again.
5. "all" — commit, push, PR description and this log.

## Research performed

- Read issue #65 and its comment. A teammate suggested notifying only the workspace owner and no grace period.
- Found that #64 (`feat-credential-scan-on-update`) only adds a warning in the editor, so #65 needs its own scan on the server. A browser-only check can't meet "notified even if the author dismissed the warning".
- Found that the `Team` model has no owner field, so "owner only" would need a new setting.
- Used `DocumentAccessRequestNotificationsTask` (which notifies admins) as the template.
- Traced how revisions are created: `RevisionsProcessor` saves a revision after edits stop (about 30 seconds in development, 5 minutes in production), on "Done editing" and on publish. Each one emits `revisions.create`.
- Confirmed `Notification.data` is a JSONB column, so no migration is needed, and that `EmailsProcessor` sends nothing for unknown event types, so the notification stays in-app.

## Design decisions

- **Scan on the server on `revisions.create`:** this is the server's "document saved" event, and it can't be bypassed by dismissing the editor warning.
- **Only notify for new credential types:** the task compares the new revision with the previous one, so a credential that stays in a document doesn't notify admins on every save. This needs no extra state.
- **Recipients:** all active admins. The admin who saved the change is skipped, and so are admins who can't open the document (such as someone's private draft), so the title of a document they can't see isn't shown to them.
- **Never store the secret:** notifications store only the credential type names (`data.credentialTypes`).
- **Preference:** a new `CredentialDetected` event, on by default, with a toggle in notification settings that only admins see.
- **No email**, because the issue limits this to in-app notifications.

## Implementation

- `shared/types.ts` — `NotificationEventType.CredentialDetected` (`documents.credential_detected`), its default, and `credentialTypes` on `NotificationData`.
- `server/queues/tasks/DocumentCredentialNotificationsTask.ts` (new) — scans the revision and the one before it with `scanForCredentials` and notifies admins.
- `server/queues/processors/NotificationsProcessor.ts` — schedules the task on `revisions.create`.
- `app/models/Notification.ts` — the message ("saved a possible AWS Access Key ID in …"), the link to the document, and the "documents" filter.
- `app/scenes/Settings/Notifications.tsx` — the admin-only "Credential detected" toggle.

## Testing

- `server/queues/tasks/DocumentCredentialNotificationsTask.test.ts` (new, 8 tests): notifies admins with the credential type, never stores the value, no repeat for an existing credential, only names newly added types, nothing when there is no credential, no non-admins, not the admin who saved it, respects opt-out.
- Existing `RevisionCreatedNotificationsTask.test.ts` still passes (17 tests). `tsc`, oxlint and oxfmt were clean.
- **Manual (done):**
  - [x] As a member, added an AWS key to a published doc. The admin got an in-app notification naming the type and linking to the doc.
  - [x] Turned the preference off, and no notification arrived.
  - [x] Saved again with the same key, and no second notification arrived.
