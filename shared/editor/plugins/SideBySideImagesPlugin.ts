import { isHistoryTransaction } from "prosemirror-history";
import type { Node, NodeType } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
import { Plugin } from "prosemirror-state";
import type { Step } from "prosemirror-transform";
import { ReplaceAroundStep } from "prosemirror-transform";
import type { EditorView } from "prosemirror-view";
import { isRemoteTransaction } from "../lib/multiplayer";

/**
 * The layout available to a row of side by side images.
 */
export interface SideBySideLayout {
  /** The width of the editor content area, in pixels. */
  contentWidth: number;
  /** The horizontal margin applied to each wrapped image, in pixels. */
  gap: number;
  /** Whether the editor is currently editable. */
  editable: boolean;
}

interface SideBySideImagesPluginOptions {
  /**
   * Returns the layout to size images against. Defaults to measuring the
   * editor view, returning undefined when it cannot be measured.
   */
  getLayout?: (view: EditorView | undefined) => SideBySideLayout | undefined;
}

/** The layout class given to images inserted together as a row. */
export const imageRowLayoutClass = "left-50";

/** Layout classes that float an image so that text wraps around it. */
const wrapLayoutClasses = ["left-50", "right-50"];

/** The em size of the horizontal margin on wrapped images, see Styles.ts. */
const wrapMarginEm = 2;

/**
 * A ProseMirror plugin that automatically resizes wrapped images placed side
 * by side so that they share the available content width equally. Images are
 * re-laid out only when the membership of a row changes, so manual resizes are
 * retained until an image is added to or removed from the row.
 */
export class SideBySideImagesPlugin extends Plugin {
  constructor(options: SideBySideImagesPluginOptions = {}) {
    const getLayout = options.getLayout ?? measureLayout;
    let editorView: EditorView | undefined;

    super({
      view: (view) => {
        editorView = view;
        return {
          destroy: () => {
            editorView = undefined;
          },
        };
      },
      appendTransaction: (transactions, oldState, newState) => {
        // Remote changes are laid out by the client that made them, and undo or
        // redo restores sizes exactly as they were.
        if (
          oldState.doc.eq(newState.doc) ||
          transactions.some(
            (tr) => isRemoteTransaction(tr) || isHistoryTransaction(tr)
          )
        ) {
          return null;
        }

        const imageType = newState.schema.nodes.image;
        if (!imageType) {
          return null;
        }

        const rows = findRowsToRelayout(
          transactions,
          oldState,
          newState,
          imageType
        );
        if (rows.length === 0) {
          return null;
        }

        const layout = getLayout(editorView);
        if (!layout || !layout.editable || layout.contentWidth <= 0) {
          return null;
        }

        let tr: Transaction | undefined;
        for (const row of rows) {
          // A lone image left behind after its row shrank returns to a half
          // width so that text can still wrap beside it.
          const count = Math.max(row.length, 2);
          const width = Math.floor(
            (layout.contentWidth - layout.gap * count) / count
          );
          if (width <= 0) {
            continue;
          }

          for (const pos of row) {
            const node = newState.doc.nodeAt(pos);
            if (!node || node.attrs.width === width) {
              continue;
            }
            tr = (tr ?? newState.tr).setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width,
              height: scaledHeight(node, width),
            });
          }
        }

        return tr ?? null;
      },
    });
  }
}

/**
 * Finds groups of wrapped images that sit side by side: consecutive images in
 * the same textblock, with a wrap layout, separated by nothing but whitespace.
 * A lone wrapped image is returned as a group of one.
 *
 * @param doc the document to search.
 * @param imageType the image node type.
 * @returns the positions of the images in each group, in document order.
 */
export function findImageRows(doc: Node, imageType: NodeType): number[][] {
  const rows: number[][] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true;
    }

    let current: number[] = [];
    node.forEach((child, offset) => {
      if (isWrappedImage(child, imageType)) {
        current.push(pos + 1 + offset);
        return;
      }
      if (child.isText && !child.text?.trim()) {
        return;
      }
      if (current.length) {
        rows.push(current);
      }
      current = [];
    });
    if (current.length) {
      rows.push(current);
    }

    return false;
  });

  return rows;
}

/**
 * Prepares a position at which a row of side by side images can be inserted.
 * Positions inside a textblock are used as is, an empty textblock directly
 * after the position is reused, and otherwise a new paragraph is inserted.
 *
 * @param tr the transaction to add a new paragraph to, if one is needed.
 * @param pos the position the images were requested at.
 * @returns the position inside a textblock to insert the images at, or
 * undefined if images cannot be placed in a row at this position.
 */
export function prepareImageRow(
  tr: Transaction,
  pos: number
): number | undefined {
  const { image: imageType, paragraph: paragraphType } =
    tr.doc.type.schema.nodes;
  if (!imageType) {
    return undefined;
  }

  const $pos = tr.doc.resolve(pos);
  if ($pos.parent.inlineContent) {
    return $pos.parent.canReplaceWith($pos.index(), $pos.index(), imageType)
      ? pos
      : undefined;
  }

  const { nodeAfter } = $pos;
  if (
    nodeAfter?.isTextblock &&
    nodeAfter.content.size === 0 &&
    nodeAfter.canReplaceWith(0, 0, imageType)
  ) {
    return pos + 1;
  }

  if (
    !paragraphType ||
    !$pos.parent.canReplaceWith($pos.index(), $pos.index(), paragraphType)
  ) {
    return undefined;
  }

  tr.insert(pos, paragraphType.create());
  return pos + 1;
}

/**
 * Compares the rows of side by side images before and after a set of
 * transactions and returns the rows whose membership changed.
 *
 * @param transactions the transactions applied between the two states.
 * @param oldState the state before the transactions.
 * @param newState the state after the transactions.
 * @param imageType the image node type.
 * @returns the image positions of each row that should be re-laid out.
 */
function findRowsToRelayout(
  transactions: readonly Transaction[],
  oldState: EditorState,
  newState: EditorState,
  imageType: NodeType
): number[][] {
  const steps = transactions.flatMap((tr) => tr.steps);

  // For each surviving image, remember the row it previously belonged to.
  const previousRowByPos = new Map<number, { key: string; size: number }>();
  for (const row of findImageRows(oldState.doc, imageType)) {
    const mapped = row
      .map((pos) => mapNodePos(steps, pos))
      .filter((pos): pos is number => pos !== undefined);
    const previous = { key: mapped.join(","), size: row.length };
    mapped.forEach((pos) => previousRowByPos.set(pos, previous));
  }

  return findImageRows(newState.doc, imageType).filter((row) => {
    const previous = previousRowByPos.get(row[0]);
    const unchanged =
      previous?.key === row.join(",") && previous.size === row.length;
    if (unchanged) {
      return false;
    }
    if (row.length > 1) {
      return true;
    }

    // A single image is only re-laid out when it was left behind by a row.
    return !!previous && previous.size > 1;
  });
}

/**
 * Maps the position of a node through a series of steps. Unlike a plain
 * position mapping, a step that only changes the node's attributes (such as a
 * resize) is not treated as deleting it.
 *
 * @param steps the steps to map through.
 * @param pos the position of the node before the steps.
 * @returns the position after the steps, or undefined if it was deleted.
 */
function mapNodePos(steps: readonly Step[], pos: number): number | undefined {
  let current = pos;
  for (const step of steps) {
    if (
      step instanceof ReplaceAroundStep &&
      step.from === current &&
      step.gapFrom === current + 1 &&
      step.gapTo === step.to - 1
    ) {
      continue;
    }

    const result = step.getMap().mapResult(current, 1);
    if (result.deleted) {
      return undefined;
    }
    current = result.pos;
  }
  return current;
}

/**
 * Measures the editor view to determine the width available to images.
 *
 * @param view the editor view, if mounted.
 * @returns the measured layout, or undefined if the view is not mounted.
 */
function measureLayout(
  view: EditorView | undefined
): SideBySideLayout | undefined {
  if (!view) {
    return undefined;
  }

  const style = window.getComputedStyle(view.dom);
  const padding =
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0);

  return {
    contentWidth: view.dom.clientWidth - padding,
    gap: (parseFloat(style.fontSize) || 16) * wrapMarginEm,
    editable: view.editable,
  };
}

/**
 * Returns the height that preserves the image's aspect ratio at a new width.
 *
 * @param node the image node.
 * @param width the new width.
 * @returns the scaled height, or the existing height if the ratio is unknown.
 */
function scaledHeight(node: Node, width: number): number | undefined {
  const { width: currentWidth, height } = node.attrs;
  if (!currentWidth || !height) {
    return height;
  }
  return Math.round((width * height) / currentWidth);
}

/**
 * Whether the node is an image with a layout that wraps text around it.
 *
 * @param node the node to check.
 * @param imageType the image node type.
 * @returns true if the node is a wrapped image.
 */
function isWrappedImage(node: Node, imageType: NodeType): boolean {
  return (
    node.type === imageType &&
    wrapLayoutClasses.includes(node.attrs.layoutClass)
  );
}
