import type { Node } from "prosemirror-model";
import { ProsemirrorHelper } from "@shared/utils/ProsemirrorHelper";

/**
 * Returns the character count to display for a comment editor's document,
 * counting each node boundary (eg. a paragraph break) as one character. This
 * mirrors the unit that the MaxLength extension enforces against, so the two
 * can never disagree. An empty document is reported as zero rather than the
 * small non-zero size of its empty wrapping paragraph.
 *
 * @param doc The document to measure.
 * @returns The character count, or zero if the document is empty.
 */
export function getCommentCharacterCount(doc: Node): number {
  return ProsemirrorHelper.isEmpty(doc) ? 0 : doc.nodeSize;
}
