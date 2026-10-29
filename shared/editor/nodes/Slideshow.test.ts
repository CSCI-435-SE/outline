import type { EditorState, Transaction } from "prosemirror-state";
import { NodeSelection } from "prosemirror-state";
import {
  createEditorState,
  extensionManager,
  findNodes,
  p,
  schema,
} from "../../test/editor";
import { buildSelectionContext } from "../lib/buildSelectionContext";
import {
  DEFAULT_SLIDESHOW_INTERVAL,
  formatSlideshowInterval,
} from "../lib/slideshow";
import Slideshow from "./Slideshow";

const serializer = extensionManager.serializer();
const parser = extensionManager.parser({
  schema,
  plugins: extensionManager.rulePlugins,
});

const extension = new Slideshow();
const { slideshowInterval } = extension.commands({
  type: schema.nodes.slideshow,
});

/**
 * Creates a state with a slideshow selected, as it is when the toolbar shows.
 */
function selectedSlideshow(interval?: number) {
  const state = createEditorState(
    schema.nodes.doc.create(null, [
      p("Before"),
      schema.nodes.slideshow.create({
        images: ["https://example.com/a.png", "https://example.com/b.png"],
        interval,
      }),
      p("After"),
    ])
  );
  return state.apply(state.tr.setSelection(NodeSelection.create(state.doc, 8)));
}

function run(state: EditorState, interval: unknown) {
  let next = state;
  const result = slideshowInterval({ interval })(state, (tr: Transaction) => {
    next = state.apply(tr);
  });
  return { result, state: next };
}

describe("slideshowInterval command", () => {
  it("updates the interval of the selected slideshow", () => {
    const { result, state } = run(selectedSlideshow(), 5000);
    const { selection } = state;

    expect(result).toBe(true);
    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.attrs.interval).toBe(5000);
    expect((selection as NodeSelection).node.attrs.images).toHaveLength(2);
  });

  it("persists the interval through markdown", () => {
    const { state } = run(selectedSlideshow(), 8000);
    const markdown = serializer.serialize(state.doc);

    expect(markdown).toContain(":::slideshow 8000");
    expect(parser.parse(markdown)?.toJSON()).toEqual(state.doc.toJSON());
  });

  it("falls back to the default for an invalid interval", () => {
    const { state } = run(selectedSlideshow(5000), "fast");

    expect((state.selection as NodeSelection).node.attrs.interval).toBe(
      DEFAULT_SLIDESHOW_INTERVAL
    );
  });

  it("does nothing when no slideshow is selected", () => {
    const state = createEditorState(schema.nodes.doc.create(null, [p("Hi")]));

    expect(run(state, 5000).result).toBe(false);
  });

  it("uses the default interval for slideshows without one", () => {
    const [node] = findNodes(
      parser
        .parse(
          `:::slideshow
![](https://example.com/a.png)
:::`
        )
        ?.toJSON(),
      "slideshow"
    );

    expect(node?.attrs?.interval).toBe(DEFAULT_SLIDESHOW_INTERVAL);
  });
});

describe("slideshow toolbar", () => {
  const [menu] = extension.selectionToolbarMenus();

  const context = (state: EditorState, readOnly = false) =>
    buildSelectionContext(state, { readOnly, isTemplate: false, rtl: false });

  it("shows for a selected slideshow when editing", () => {
    const state = selectedSlideshow();

    expect(menu.matches(context(state))).toBe(true);
    expect(menu.matches(context(state, true))).toBe(false);
  });

  it("lists the speeds and marks the current one active", () => {
    const state = selectedSlideshow(5000);
    const [item] = menu.getItems(context(state));
    const children = Array.isArray(item.children) ? item.children : [];

    expect(item.label).toBe(formatSlideshowInterval(5000));
    expect(children.map((child) => child.attrs)).toEqual([
      { interval: 2000 },
      { interval: 3000 },
      { interval: 5000 },
      { interval: 8000 },
      { interval: 10000 },
    ]);
    expect(
      children
        .filter((child) => child.active?.(state))
        .map((child) => child.label)
    ).toEqual([formatSlideshowInterval(5000)]);
  });
});
