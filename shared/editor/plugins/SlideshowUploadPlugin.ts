import type { EditorState, Transaction } from "prosemirror-state";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { SlideshowUploadItem } from "../lib/slideshow";
import { mapDecorations } from "../lib/multiplayer";

/** The uploads in progress for a single slideshow, attached as a decoration. */
export interface SlideshowUploadSession {
  /** A unique id for the session. */
  id: string;
  /** The upload items, in the order the files were selected. */
  items: readonly SlideshowUploadItem[];
  /** Uploads a failed item again. */
  retry: (itemId: string) => void;
  /** Removes a failed item from the slideshow. */
  dismiss: (itemId: string) => void;
}

/** The range of the slideshow node a session is attached to. */
export interface SlideshowUploadRange {
  /** The position before the slideshow node. */
  from: number;
  /** The position after the slideshow node. */
  to: number;
}

/** A change to the upload sessions, passed as transaction meta. */
export type SlideshowUploadAction =
  | { add: { pos: number; session: SlideshowUploadSession } }
  | { update: SlideshowUploadSession }
  | { remove: string };

/** The key of the plugin that tracks slideshow uploads. */
export const slideshowUploadKey = new PluginKey<DecorationSet>(
  "slideshowUploads"
);

/**
 * Tracks images being uploaded into slideshows. Each session is a node
 * decoration on its slideshow, so it follows the node as the document changes
 * and is passed to the node's component to render progress.
 */
export class SlideshowUploadPlugin extends Plugin<DecorationSet> {
  constructor() {
    super({
      key: slideshowUploadKey,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, set) => applyAction(tr, mapDecorations(set, tr)),
      },
      props: {
        decorations: (state) => slideshowUploadKey.getState(state),
      },
    });
  }
}

/**
 * Returns the upload session attached to a slideshow node's decorations.
 *
 * @param decorations the decorations passed to the node view.
 * @returns the session, or undefined if no images are uploading.
 */
export function getSlideshowUploadSession(
  decorations: readonly Decoration[]
): SlideshowUploadSession | undefined {
  for (const decoration of decorations) {
    const session: unknown = decoration.spec.slideshowUpload;
    if (isSession(session)) {
      return session;
    }
  }
  return undefined;
}

/**
 * Finds the slideshow node an upload session is attached to.
 *
 * @param state the editor state.
 * @param id the session id.
 * @returns the range of the slideshow node, or undefined if it was removed.
 */
export function findSlideshowUpload(
  state: EditorState,
  id: string
): SlideshowUploadRange | undefined {
  const [decoration] =
    slideshowUploadKey
      .getState(state)
      ?.find(undefined, undefined, (spec) => spec.id === id) ?? [];
  return decoration ? { from: decoration.from, to: decoration.to } : undefined;
}

function isSession(value: unknown): value is SlideshowUploadSession {
  return !!value && typeof value === "object" && "items" in value;
}

function createDecoration(
  range: SlideshowUploadRange,
  session: SlideshowUploadSession
) {
  return Decoration.node(
    range.from,
    range.to,
    {},
    { id: session.id, slideshowUpload: session }
  );
}

function applyAction(tr: Transaction, set: DecorationSet): DecorationSet {
  const action: SlideshowUploadAction | undefined =
    tr.getMeta(slideshowUploadKey);
  if (!action) {
    return set;
  }

  if ("add" in action) {
    const { pos, session } = action.add;
    const node = tr.doc.nodeAt(pos);
    if (!node) {
      return set;
    }
    return set.add(tr.doc, [
      createDecoration({ from: pos, to: pos + node.nodeSize }, session),
    ]);
  }

  const id = "update" in action ? action.update.id : action.remove;
  const existing = set.find(undefined, undefined, (spec) => spec.id === id);
  if (!existing.length) {
    return set;
  }

  set = set.remove(existing);
  if ("update" in action) {
    set = set.add(tr.doc, [createDecoration(existing[0], action.update)]);
  }
  return set;
}
