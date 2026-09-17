Claude finished the response

I don't have access to the actual Outline repository files — I was working from general knowledge of the codebase structure. To give you a precise, ready-to-commit patch, I need to see the real file.

Could you paste the contents of the title component? It's likely at one of these paths:

    shared/editor/components/Title.tsx
    app/editor/components/Title.tsx
    app/components/DocumentTitle.tsx

You can find it quickly with:
bash

grep -r "contentEditable" app/ shared/ --include="*.tsx" -l

Once you paste the file, I'll produce an exact diff you can apply directly.

import { observer } from "mobx-react"; import { Slice } from "prosemirror-model"; import { Selection } from "prosemirror-state"; import { __parseFromClipboard } from "prosemirror-view"; import * as React from "react"; import { mergeRefs } from "react-merge-refs"; import styled, { css } from "styled-

pasted

Now I have the real file. Key observations:

    maxLength={DocumentValidation.maxTitleLength} is already passed to ContentEditable — the limit exists
    Title is a styled ContentEditable, not a raw input
    Need to track focus state and show a counter only while editing

Read a file, created a file, shared files

Here's a summary of every change made (all marked with // + in the file):

1. isFocused state — one new useState(false) to gate the counter's visibility.

2. handleFocus — sets isFocused(true); wired to onFocus on the Title component.

3. handleBlur addition — added setIsFocused(false) before the existing blur logic. The early-return guard that was already there (for icon picker sibling focus) is preserved, so the counter stays up when clicking the icon picker.

4. maxLength / remaining / isNearLimit — derived from DocumentValidation.maxTitleLength (the same constant already used), so no magic numbers. isNearLimit turns red when ≤ 20 characters remain.

5. TitleWrapper — a position: relative div wrapping the title block, giving the counter something to anchor to.

6. CharCounter — position: absolute; bottom: -1.25em; right: 0. Uses s("textTertiary") normally and s("danger") near the limit, so it respects Outline's theme tokens (light/dark mode included). Hidden in readOnly mode. Has aria-live="polite" for screen readers.

The file is ready to drop in as a replacement for the original.
Documenttitle
Code·TSX 

will I need to re build to see the changes made in this file

Yes, but in Outline's dev setup it should be automatic — no manual rebuild needed.

Outline uses Webpack with hot module replacement (HMR), so as long as your dev server is running (yarn dev or yarn dev:app), saving the file will trigger an automatic recompile and the browser will update without a full page reload.

The only times you'd need to manually restart are:

    You changed a file outside the webpack watch scope (e.g. a server file, .env, or webpack.config.js)
    The HMR websocket connection dropped — you'd see the browser stop updating, and a manual refresh fixes it
    You're not running the dev server at all, in which case run yarn dev from the repo root

So just save the file and the browser should reflect the changes within a few seconds.

I'd prefer if the format was [character used/characters allowed]

Small change — swap {remaining} for {title.length}/{maxLength} in the JSX and drop the isNearLimit trigger to fire when title.length is near the max instead:
Read a file, edited a file, shared files

Done. The counter now displays as e.g. 42/255, and turns red when within 20 characters of the limit (235/255 and beyond).
Documenttitle
Code·TSX 


