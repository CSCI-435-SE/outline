import type { Command } from "prosemirror-state";
import { NodeSelection } from "prosemirror-state";
import { toSlideshowAttrs } from "../lib/slideshow";

/**
 * Creates a command that replaces the image list of the slideshow at the
 * given position in a single transaction, so the change is one undoable step.
 * If the slideshow is selected it stays selected.
 *
 * @param pos the position before the slideshow node.
 * @param update returns the new image list, or undefined if nothing changes.
 * @returns the command.
 */
export function updateSlideshowImages(
  pos: number,
  update: (images: string[]) => string[] | undefined
): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node?.type !== state.schema.nodes.slideshow) {
      return false;
    }

    const images = update(toSlideshowAttrs(node.attrs).images);
    if (!images) {
      return false;
    }

    if (dispatch) {
      const { selection } = state;
      const tr = state.tr.setNodeAttribute(pos, "images", images);
      if (selection instanceof NodeSelection && selection.from === pos) {
        tr.setSelection(NodeSelection.create(tr.doc, pos));
      }
      dispatch(tr);
    }
    return true;
  };
}
