import type { Node } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";
import { NodeSelection } from "prosemirror-state";
import { history, undo } from "prosemirror-history";
import {
  codeBlock,
  createEditorState,
  doc,
  p,
  schema,
} from "@shared/test/editor";
import type { SideBySideLayout } from "./SideBySideImagesPlugin";
import {
  SideBySideImagesPlugin,
  findImageRows,
  prepareImageRow,
} from "./SideBySideImagesPlugin";

const layout: SideBySideLayout = { contentWidth: 760, gap: 32, editable: true };

function image(attrs: Record<string, unknown> = {}) {
  return schema.nodes.image.create({
    src: "https://example.com/image.png",
    width: 600,
    height: 300,
    layoutClass: "left-50",
    ...attrs,
  });
}

function paragraph(...content: Node[]) {
  return schema.nodes.paragraph.create(null, content);
}

function createState(content: Node[], options = layout) {
  return createEditorState(doc(content), [
    history(),
    new SideBySideImagesPlugin({ getLayout: () => options }),
  ]);
}

function images(state: EditorState) {
  const result: Node[] = [];
  state.doc.descendants((node) => {
    if (node.type.name === "image") {
      result.push(node);
    }
  });
  return result;
}

function widths(state: EditorState) {
  return images(state).map((node) => node.attrs.width);
}

/** Inserts a wrapped image at the end of the first paragraph. */
function appendImage(state: EditorState, attrs = {}) {
  const end = state.doc.firstChild!.nodeSize - 1;
  return state.apply(state.tr.insert(end, image(attrs)));
}

/** Deletes the image at the given index in document order. */
function deleteImage(state: EditorState, index: number) {
  const positions: number[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === "image") {
      positions.push(pos);
    }
  });
  const pos = positions[index];
  return state.apply(state.tr.delete(pos, pos + 1));
}

// Two images share (760 - 32 * 2) / 2 = 348px, three share (760 - 32 * 3) / 3 = 221px.
const twoUp = 348;
const threeUp = 221;

describe("SideBySideImagesPlugin", () => {
  it("resizes two images placed side by side to share the width", () => {
    const state = appendImage(createState([paragraph(image())]));

    expect(widths(state)).toEqual([twoUp, twoUp]);
  });

  it("preserves the aspect ratio of each image", () => {
    const state = appendImage(createState([paragraph(image())]), {
      width: 400,
      height: 400,
    });

    const [first, second] = images(state);
    expect(first.attrs.height).toBe(Math.round((twoUp * 300) / 600));
    expect(second.attrs.height).toBe(twoUp);
  });

  it("shrinks every image when a third is added", () => {
    let state = appendImage(createState([paragraph(image())]));
    state = appendImage(state);

    expect(widths(state)).toEqual([threeUp, threeUp, threeUp]);
  });

  it("grows the remaining images when one is removed", () => {
    let state = appendImage(createState([paragraph(image())]));
    state = appendImage(state);
    state = deleteImage(state, 2);

    expect(widths(state)).toEqual([twoUp, twoUp]);
  });

  it("returns a lone image to half width when its row is broken up", () => {
    let state = appendImage(createState([paragraph(image())]));
    state = deleteImage(state, 1);

    expect(widths(state)).toEqual([twoUp]);
  });

  it("treats left and right wrapped images as side by side", () => {
    const state = appendImage(createState([paragraph(image())]), {
      layoutClass: "right-50",
    });

    expect(widths(state)).toEqual([twoUp, twoUp]);
  });

  it("resizes images when wrap text is enabled on a neighbour", () => {
    let state = createState([paragraph(image(), image({ layoutClass: null }))]);
    // The first image spans positions 1-2, so the second starts at 3.
    const pos = 3;
    state = state.apply(
      state.tr.setNodeMarkup(pos, undefined, {
        ...state.doc.nodeAt(pos)!.attrs,
        layoutClass: "left-50",
      })
    );

    expect(widths(state)).toEqual([twoUp, twoUp]);
  });

  it("does not resize images stacked in separate paragraphs", () => {
    const state = createState([paragraph(image())]);
    const next = state.apply(
      state.tr.insert(state.doc.content.size, paragraph(image()))
    );

    expect(widths(next)).toEqual([600, 600]);
  });

  it("does not resize images separated by a line break", () => {
    const state = createState([paragraph(image(), schema.nodes.br.create())]);

    expect(widths(appendImage(state))).toEqual([600, 600]);
  });

  it("does not resize images without wrap text", () => {
    const state = createState([paragraph(image({ layoutClass: null }))]);

    expect(widths(appendImage(state, { layoutClass: null }))).toEqual([
      600, 600,
    ]);
  });

  it("does not resize a single image when it is inserted", () => {
    const state = createState([p("")]);

    expect(widths(appendImage(state))).toEqual([600]);
  });

  it("retains a manual resize until an image joins the row", () => {
    let state = appendImage(createState([paragraph(image())]));
    const tr = state.tr.setSelection(NodeSelection.create(state.doc, 1));
    state = state.apply(
      tr.setNodeMarkup(1, undefined, {
        ...state.doc.nodeAt(1)!.attrs,
        width: 200,
        height: 100,
      })
    );
    expect(widths(state)).toEqual([200, twoUp]);

    state = appendImage(state);
    expect(widths(state)).toEqual([threeUp, threeUp, threeUp]);
  });

  it("does not resize when the editor is read only", () => {
    const state = createState([paragraph(image())], {
      ...layout,
      editable: false,
    });

    expect(widths(appendImage(state))).toEqual([600, 600]);
  });

  it("reverts the resize together with the insert on undo", () => {
    const state = appendImage(createState([paragraph(image())]));
    let reverted: EditorState | undefined;
    undo(state, (tr) => {
      reverted = state.apply(tr);
    });

    expect(widths(reverted!)).toEqual([600]);
  });

  describe("prepareImageRow", () => {
    it("uses a position inside a paragraph as is", () => {
      const state = createState([p("hello")]);
      const tr = state.tr;

      expect(prepareImageRow(tr, 3)).toBe(3);
      expect(tr.docChanged).toBe(false);
    });

    it("reuses an empty paragraph after the position", () => {
      const state = createState([p("hello"), p("")]);
      const pos = state.doc.firstChild!.nodeSize;
      const tr = state.tr;

      expect(prepareImageRow(tr, pos)).toBe(pos + 1);
      expect(tr.docChanged).toBe(false);
    });

    it("inserts a paragraph between blocks", () => {
      const state = createState([p("hello"), p("world")]);
      const pos = state.doc.firstChild!.nodeSize;
      const tr = state.tr;

      expect(prepareImageRow(tr, pos)).toBe(pos + 1);
      expect(tr.doc.childCount).toBe(3);
      expect(tr.doc.child(1).content.size).toBe(0);
    });

    it("returns undefined inside a code block", () => {
      const state = createState([codeBlock("code")]);

      expect(prepareImageRow(state.tr, 2)).toBeUndefined();
    });

    it("lays out images inserted one after another into the row", () => {
      let state = createState([p("hello"), p("world")]);
      const tr = state.tr;
      const pos = prepareImageRow(tr, state.doc.firstChild!.nodeSize)!;
      state = state.apply(tr);

      // Uploads complete in order, each inserted after the previous image.
      for (let i = 0; i < 3; i++) {
        const end = state.doc.resolve(pos).end();
        state = state.apply(state.tr.insert(end, image()));
      }

      expect(widths(state)).toEqual([threeUp, threeUp, threeUp]);
      expect(findImageRows(state.doc, schema.nodes.image)).toHaveLength(1);
    });
  });

  describe("findImageRows", () => {
    it("groups consecutive wrapped images, ignoring whitespace", () => {
      const state = createState([
        paragraph(image(), schema.text(" "), image()),
        paragraph(image()),
      ]);

      expect(
        findImageRows(state.doc, schema.nodes.image).map((row) => row.length)
      ).toEqual([2, 1]);
    });

    it("splits rows on text between images", () => {
      const state = createState([
        paragraph(image(), schema.text("words"), image()),
      ]);

      expect(
        findImageRows(state.doc, schema.nodes.image).map((row) => row.length)
      ).toEqual([1, 1]);
    });
  });
});
