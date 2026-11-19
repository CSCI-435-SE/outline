import { history, undo } from "prosemirror-history";
import type { Command, EditorState, Transaction } from "prosemirror-state";
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
    const item = menu
      .getItems(context(state))
      .find((candidate) => candidate.name === "slideshowInterval");
    if (!item) {
      throw new Error("No speed menu");
    }
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

describe("slideshow add images button", () => {
  const [menu] = extension.selectionToolbarMenus();

  it("is hidden when the editor can't upload files", () => {
    const state = selectedSlideshow();
    const item = menu
      .getItems(
        buildSelectionContext(state, {
          readOnly: false,
          isTemplate: false,
          rtl: false,
        })
      )
      .find((candidate) => candidate.name === "uploadSlideshowImages");

    expect(item?.visible).toBe(false);
  });
});

describe("slideshow image commands", () => {
  const a = "https://example.com/a.png";
  const b = "https://example.com/b.png";
  const c = "https://example.com/c.png";
  const commands = extension.commands({ type: schema.nodes.slideshow });

  /**
   * Creates a state with a slideshow of the given images selected, tracking
   * history so changes can be undone.
   */
  function withImages(images: string[]) {
    const state = createEditorState(
      schema.nodes.doc.create(null, [
        p("Before"),
        schema.nodes.slideshow.create({ images, interval: 5000 }),
        p("After"),
      ]),
      [history()]
    );
    return state.apply(
      state.tr.setSelection(NodeSelection.create(state.doc, 8))
    );
  }

  function apply(state: EditorState, command: Command) {
    let next = state;
    const result = command(state, (tr: Transaction) => {
      next = state.apply(tr);
    });
    return { result, state: next };
  }

  function imagesOf(state: EditorState) {
    const [node] = findNodes(state.doc.toJSON(), "slideshow");
    return node?.attrs?.images;
  }

  function undoOnce(state: EditorState) {
    let next = state;
    undo(state, (tr: Transaction) => {
      next = state.apply(tr);
    });
    return next;
  }

  it("adds images to the end and keeps the slideshow selected", () => {
    const { result, state } = apply(
      withImages([a]),
      commands.addSlideshowImages({ images: [b, c] })
    );

    expect(result).toBe(true);
    expect(imagesOf(state)).toEqual([a, b, c]);
    expect(state.selection).toBeInstanceOf(NodeSelection);
    expect((state.selection as NodeSelection).node.attrs.interval).toBe(5000);
  });

  it("does nothing when no usable images are added", () => {
    const { result } = apply(
      withImages([a]),
      commands.addSlideshowImages({ images: ["javascript:alert(1)"] })
    );

    expect(result).toBe(false);
  });

  it("removes an image", () => {
    const { result, state } = apply(
      withImages([a, b, c]),
      commands.removeSlideshowImage({ index: 1 })
    );

    expect(result).toBe(true);
    expect(imagesOf(state)).toEqual([a, c]);
  });

  it("keeps an empty slideshow when the last image is removed", () => {
    const { state } = apply(
      withImages([a]),
      commands.removeSlideshowImage({ index: 0 })
    );

    expect(imagesOf(state)).toEqual([]);
    expect(findNodes(state.doc.toJSON(), "slideshow")).toHaveLength(1);
    expect(state.selection).toBeInstanceOf(NodeSelection);
  });

  it("reorders images", () => {
    const { result, state } = apply(
      withImages([a, b, c]),
      commands.moveSlideshowImage({ from: 2, to: 0 })
    );

    expect(result).toBe(true);
    expect(imagesOf(state)).toEqual([c, a, b]);
  });

  it("rejects invalid indexes", () => {
    const state = withImages([a, b]);

    expect(
      apply(state, commands.removeSlideshowImage({ index: 2 })).result
    ).toBe(false);
    expect(
      apply(state, commands.removeSlideshowImage({ index: "0" })).result
    ).toBe(false);
    expect(apply(state, commands.removeSlideshowImage()).result).toBe(false);
    expect(
      apply(state, commands.moveSlideshowImage({ from: 0, to: 5 })).result
    ).toBe(false);
    expect(
      apply(state, commands.moveSlideshowImage({ from: 1, to: 1 })).result
    ).toBe(false);
  });

  it("does nothing when no slideshow is selected", () => {
    const state = createEditorState(schema.nodes.doc.create(null, [p("Hi")]));

    expect(
      apply(state, commands.addSlideshowImages({ images: [a] })).result
    ).toBe(false);
    expect(
      apply(state, commands.removeSlideshowImage({ index: 0 })).result
    ).toBe(false);
    expect(
      apply(state, commands.moveSlideshowImage({ from: 0, to: 1 })).result
    ).toBe(false);
  });

  it.each([
    ["add", commands.addSlideshowImages({ images: [c] })],
    ["remove", commands.removeSlideshowImage({ index: 0 })],
    ["reorder", commands.moveSlideshowImage({ from: 0, to: 1 })],
  ])("undoes %s in a single step", (_name, command) => {
    const initial = withImages([a, b]);
    const { state } = apply(initial, command);

    expect(imagesOf(state)).not.toEqual([a, b]);
    expect(imagesOf(undoOnce(state))).toEqual([a, b]);
  });

  it("round trips edited images through markdown", () => {
    let { state } = apply(
      withImages([a, b]),
      commands.addSlideshowImages({ images: [c] })
    );
    ({ state } = apply(state, commands.moveSlideshowImage({ from: 2, to: 0 })));
    ({ state } = apply(state, commands.removeSlideshowImage({ index: 1 })));
    const markdown = serializer.serialize(state.doc);

    expect(imagesOf(state)).toEqual([c, b]);
    expect(parser.parse(markdown)?.toJSON()).toEqual(state.doc.toJSON());
  });
});
