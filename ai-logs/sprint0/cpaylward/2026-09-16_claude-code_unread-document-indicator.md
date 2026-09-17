This is a student fork of **Outline** (the open-source collaborative wiki/knowledge-base app) used for a CSCI-435 Software Engineering course — repo `CSCI-435-SE/outline`, cloned at `/home/con/software_engineering/outline`. It's a large TypeScript monorepo (React/MobX frontend in `app/`, Koa/Sequelize backend in `server/`, shared code in `shared/`, plugin system in `plugins/`), with `AGENTS.md` holding detailed coding conventions (strict TS, no `any`, styled-components, JSDoc on exports, etc.). There's also `STUDENTS.md`, a custom guide for course setup (Docker, local dev workflow) — recent commit history is entirely docs/setup polish for students (Windows/Docker instructions, seed-demo script) with no recent feature work on main.

**Current working-tree state (uncommitted):**
- `app/scenes/Document/components/DocumentTitle.tsx` — an in-progress **character counter** feature for the document title field: tracks focus state, shows a `{length}/{maxLength}` badge under the title while focused (turns to a "danger" color within 20 chars of `DocumentValidation.maxTitleLength`), wrapped in a new `TitleWrapper`/`CharCounter` styled-component. Looks functionally reasonable but incomplete/rough — comments are informal (`// +`) as if marking a diff, not real inline documentation, which conflicts with the AGENTS.md JSDoc convention for exported/public code (though this is a local const, so likely fine).
- Both `DocumentTitle.tsx` and `EditableTitle.tsx` lost their trailing newline at EOF (shows as `\ No newline at end of file` in the diff) — that's an accidental edit, not part of the counter feature, and will likely trip `oxfmt`/lint on commit.
- An untracked stray file: `app/components/.EditableTitle.tsx.swp` — a leftover Vim swap file, should not be committed.
- Git is otherwise clean and up to date with `origin/main`.

Want me to: finish/clean up the character counter feature (fix the EOF newlines, tidy comments to match the style guide, run lint/tsc/tests), or just remove the stray swap file and leave the WIP as-is?
I've kicked off research into how Outline currently tracks document views/reads, so we can figure out exactly what's missing for a sidebar unread indicator. I'll report back with a concrete plan once it's back — in the meantime, is there anything specific from the issue discussion (e.g., a reply from `maljassar7` about where exactly they want the dot, or whether it should also apply to the "Recently updated" list) that you already have, or should I just propose scope based on the issue text as-is?
Research confirms this is mostly a wiring gap, not new infrastructure — good news for scope. Here's the picture:

**Already built and just sitting unused:**
- Backend already tracks per-user "have I viewed this doc" via the `View` model, and `Document.lastViewedAt` is exposed to the frontend.
- The frontend already has an `isBadgedNew` getter (`!lastViewedAt && created <14 days ago`) used for a "New" text badge on `DocumentListItem` (the recently-updated list).
- There's already a **sidebar dot primitive** (`UnreadBadge` component + `unreadBadge` prop threaded through `SidebarLink`/`DocumentRow`), currently only wired up in `SharedWithMeLink.tsx` for unread *notifications* — not for "never opened."

**The actual gap:** `DocumentLink.tsx` (the component that renders each doc row in the collection sidebar tree) never passes `unreadBadge` at all. Wiring it up the same way `SharedWithMeLink.tsx` does is most of the work.

**One real wrinkle:** `documents.list` (used to hydrate the sidebar tree) doesn't apply the `withViews` scope, so `lastViewedAt` may come back `undefined` for docs the sidebar has loaded but that were never fetched via `documents.info`/`documents.viewed`/etc. — meaning the dot could be wrong (always "unread") until that's fixed or worked around.

Two decisions before I touch code:
Direct code inspection turned up something important: **the `withViews` gap the earlier research flagged doesn't actually exist.** `documents.list` (and `fetchChildDocuments`, which is what populates the sidebar tree's `Document` objects) both go through `Document.withMembershipScope()`, and that method has included the `withViews` scope since PR #9134 (May 2025) — confirmed via `git log -p` on that method. So `lastViewedAt` is already reliably populated wherever the sidebar loads document data. I'm not going to introduce a fake fix for a problem that isn't there.

Now wiring the actual sidebar dot using the existing `isBadgedNew` getter (same "never viewed" signal already used for the collection's "New" badge), in `DocumentLink.tsx`:
No type errors in `DocumentLink.tsx`. Let's confirm the whole typecheck didn't fail elsewhere for unrelated reasons and run lint on the touched file.
No lint warnings in the changed file. Let's view the final diff to confirm exactly what changed.
Here's what changed and why:

**File: `app/components/Sidebar/components/DocumentLink.tsx`** (only file touched)

```diff
+  const unreadBadge =
+    !!document?.isBadgedNew && document.createdBy?.id !== user.id;
...
       icon={iconElement}
+      unreadBadge={unreadBadge}
       canEdit={canUpdate}
```

This computes the same "unread" signal Outline already uses for the yellow "New" badge on `DocumentListItem` (`document.isBadgedNew`: never viewed by this user), excludes documents the current user created themselves (same exclusion `DocumentListItem` applies), and passes it into `DocumentRow`'s existing `unreadBadge` prop — which already renders the small accent-colored dot via `SidebarLink`/`UnreadBadge`. That prop and dot component already existed and were just never connected to the collection sidebar tree (only `SharedWithMeLink.tsx` used them, for a different signal — unread notifications).

No backend changes were needed: I verified `documents.list` and `fetchChildDocuments` (the two paths that populate `Document` objects for the sidebar tree) already go through `Document.withMembershipScope()`, which has included the `withViews` scope since May 2025 (PR #9134) — so `lastViewedAt`/`isBadgedNew` is already reliable there. The earlier research report was wrong about that gap; I confirmed via `git log -p` on the method rather than taking its word for it.

One caveat worth knowing: a sidebar row only gets a real `Document` object (and thus a dot) once it's been loaded into the store — for docs that haven't been fetched yet (e.g. deep unexpanded tree nodes), the row falls back to lightweight `NavigationNode` data and just won't show a dot until it loads. That's consistent with how title/icon already degrade in this component, not a regression.

Typecheck and lint are clean on this file. Want me to also run the relevant Vitest suite (or add a test), or check this manually in the browser next?
