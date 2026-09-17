# AI Log — Submit a comment by pressing Enter

- **Tool:** Claude Code (Sonnet 5)
- **Date:** 2026-09-16
- **Issue:** #15 — "Allow submitting a comment by pressing Enter"
- **Summary:** As a user, I want to press Enter to post a comment and Shift+Enter to add a line break, so I can comment faster without reaching for my mouse.

## Prompts given

1. "I want to work on this issue: Allow submitting a comment by pressing Enter #15 ... [full issue text pasted]"
2. "it works" (confirmation after manually testing the change in the browser).

## Research performed

Delegated a research pass (subagent) to find the comment composer and understand how keyboard shortcuts are wired in the editor before writing any code:

- Comment composer: `app/scenes/Document/components/Comments/CommentForm.tsx` (owns the submit handlers and the form element) and `CommentEditor.tsx` (the actual ProseMirror editor instance, built from a custom extension list).
- The comment box uses the same shared ProseMirror rich-text editor as the main document editor, not a plain textarea.
- Key finding: the "submit via keyboard" plumbing already existed for **Mod-Enter** — `app/editor/extensions/Keys.ts` binds `Mod-Enter` to call `this.editor.props.onSave({ done: true })`, and `CommentForm.tsx` wires `onSave={handleSave}`, which dispatches a form `submit` event. `Shift-Enter` already inserts a hard line break via `shared/editor/nodes/HardBreak.ts` and needed no change.
- Critical constraint discovered: `app/editor/extensions/Keys.ts` and its `extensions/index.ts` array are **shared with the main document editor**, not comment-only. Binding plain `Enter` there would have broken normal paragraph-splitting while editing documents. This ruled out the naive fix of just adding an `Enter` case next to the existing `Mod-Enter` one in `Keys.ts`.

## Implementation

- Created a new, comment-only extension `app/editor/extensions/SubmitOnEnter.ts` that binds plain `Enter` to the same `onSave({ done: true })` call, guarded so it does nothing when the selection is inside a code block, or when the editor is empty (to avoid submitting blank comments).
- Wired the new extension into `CommentEditor.tsx`'s extension list only (not the shared document-editor list), placed last so that list items, checkboxes, code fences, toggle blocks, and mention/emoji suggestion menus — all of which already bind or intercept `Enter` — keep taking priority. `Shift-Enter` continues to work unchanged via the existing `HardBreak` extension, which is ordered earlier in the list.

## Testing / verification

- `yarn tsc --noEmit -p .` — passed across the whole project.
- `yarn oxlint --type-aware` and `yarn oxfmt --check` on the new/changed files — clean.
- No existing test pattern for this kind of small keymap extension exists in the codebase (no `Keys.test.ts` equivalent), so no new automated test was added, consistent with that convention.
- Manually verified in a running dev server (`docker compose up -d postgres redis mailpit` + `yarn dev:watch`, signed in via the Mailpit magic-link flow) — user confirmed: typing a comment and pressing Enter posts it; Shift+Enter inserts a line break instead of submitting; the existing "Post" button still works normally.

## Outcome

Feature implemented, verified working in the browser by the user ("it works"). Not yet committed to git (left as a working-tree diff pending user's decision on commit/PR).
