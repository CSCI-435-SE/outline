# AI Log — Browsable template gallery

- **Tool:** Claude Code (Opus 5.5)
- **Date:** 2026-10-08
- **Issue:** #13 — "Add a browsable template gallery with option to import community templates"
- **Summary:** As a member, I want to browse a catalog of ready made templates so I can start new documents faster, and I want the option to turn any existing page I'm viewing into a template for others to reuse.

## Prompts given

1. "resume" (no prior session context was available; Claude summarized the current branch state).
2. `git checkout -b feat/issue-13-Add-a-browsable-template-gallery-with-option-to-import-community-templates` — Claude created the branch.
3. "i need it for sprint1 not 0" — Claude recreated the branch from the latest `main` instead of the Sprint 0 docs branch.
4. "i want to commit into main" → chose option "1" (feature branch + pull request into `main`).
5. Answered design-decision questions (see below).
6. "yes" — commit, push, and write this AI log.

## Research performed

- Fetched the issue text from the GitHub API (`gh` is not installed locally).
- Delegated a research pass (subagent) to map the existing template feature. Findings:
  - Templates already exist as a `Template` model backed by the `documents` table (`template = true`), with `templates.*` API routes, a `TemplatesStore`, settings pages and a "Templatize" dialog (`documents.templatize`).
  - Creating a document with `templateId` already copies the template content into a new, separate document.
  - Gaps: no description field, no built-in templates, no gallery UI (only dropdown menus), and Templatize did not let the user name or describe the template.

## Design decisions (clarified with user via questions)

- **Built-in templates:** seeded into the database per workspace (chosen over a static client-side catalog), flagged with a new `isBuiltIn` column so the gallery can distinguish them from member-created templates.
- **Who can save a page as a template:** keep the existing policy rules (workspace admins, collection admins, and members of collections with template management set to read/write).
- **Gallery entry point:** a new "New from template…" action alongside "New document"; plain "New document" still creates a blank document.

## Implementation

- `server/migrations/20261008000000-add-description-and-is-built-in-to-templates.js` — adds `description` (TEXT) and `isBuiltIn` (BOOLEAN) to `documents`.
- `server/models/Template.ts`, `server/presenters/template.ts`, `shared/validations.ts` — new fields and a `TemplateValidation.maxDescriptionLength` limit.
- `server/routes/api/templates/*` — `description` accepted on create/update, copied on duplicate; `templates.list` query now also searches descriptions.
- `server/routes/api/documents/*` — `documents.templatize` accepts optional `title` and `description`.
- `server/onboarding/templates.ts` — five built-in templates (Meeting notes, Project brief, Retrospective, Bug report, Decision record) defined in TypeScript (project rules disallow new markdown files).
- `server/commands/builtInTemplatesProvisioner.ts` — idempotent seeding; called for new workspaces in `accountProvisioner.ts` (failures are logged and never block sign-in).
- `server/scripts/20261008000000-seed-built-in-templates.ts` — one-off script to seed existing workspaces.
- `app/components/TemplateGallery/index.tsx` — gallery modal with search, built-in/member filter, cards with title, description and badge, and a Cancel button.
- `app/utils/templateGallery.ts` — pure filtering/sorting logic for the gallery (excludes deleted and unpublished templates).
- `app/actions/definitions/documents.tsx`, `collections.tsx`, `app/hooks/useCollectionMenuAction.tsx` — "New from template…" actions (command bar and collection menu).
- `app/components/TemplatizeDialog/index.tsx` — name and description inputs.
- `app/components/Template/TemplateForm.tsx` — description input in the template editor.
- `app/models/Template.ts`, `app/stores/TemplatesStore.ts` — `description`, `isBuiltIn`, `publishedAt` and templatize arguments.

## Testing

- `app/utils/templateGallery.test.ts` — 5 unit tests (exclusions, ordering, source filter, accent/case-insensitive search, collection scoping).
- `server/commands/builtInTemplatesProvisioner.test.ts` — seeding, idempotency, deleted built-ins not recreated.
- `server/routes/api/templates/templates.test.ts` — search by description.
- `server/routes/api/documents/documents.test.ts` — templatize with custom title/description, original document unchanged, title fallback.
- Migration verified up and down on the test database; `yarn tsc` and oxlint clean; 314 tests passing across the affected server test files.
- Not verified in a running browser by the AI.

## Human review notes

- Run `yarn db:migrate` locally, and the seed script for existing workspaces, before manual testing.
