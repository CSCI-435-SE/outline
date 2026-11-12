import { NodeSelection, TextSelection } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import { createEditorState, findNodes, p, schema } from "../../test/editor";
import { updateSlideshowImages } from "./updateSlideshowImages";

const a = "https://example.com/a.png";
const b = "https://example.com/b.png";
// The slideshow follows the "Before" paragraph.
const pos = 8;

function setup() {
  return createEditorState(
    schema.nodes.doc.create(null, [
      p("Before"),
      schema.nodes.slideshow.create({ images: [a, b], interval: 5000 }),
      p("After"),
    ])
  );
}

function run(state: EditorState, at: number, next: string[] | undefined) {
  let result = state;
  const applied = updateSlideshowImages(at, () => next)(
    state,
    (tr: Transaction) => {
      result = state.apply(tr);
    }
  );
  return { applied, state: result };
}

describe("updateSlideshowImages", () => {
  it("updates the slideshow at a position without it being selected", () => {
    const { applied, state } = run(setup(), pos, [b]);
    const [node] = findNodes(state.doc.toJSON(), "slideshow");

    expect(applied).toBe(true);
    expect(node?.attrs?.images).toEqual([b]);
    expect(node?.attrs?.interval).toBe(5000);
    expect(state.selection).toBeInstanceOf(TextSelection);
  });

  it("keeps the slideshow selected when it was", () => {
    const initial = setup();
    const selected = initial.apply(
      initial.tr.setSelection(NodeSelection.create(initial.doc, pos))
    );
    const { state } = run(selected, pos, [b, a]);

    expect(state.selection).toBeInstanceOf(NodeSelection);
    expect((state.selection as NodeSelection).node.attrs.images).toEqual([
      b,
      a,
    ]);
  });

  it("does nothing when the update makes no change", () => {
    expect(run(setup(), pos, undefined).applied).toBe(false);
  });

  it("does nothing when the position isn't a slideshow", () => {
    expect(run(setup(), 0, [a]).applied).toBe(false);
  });
});
