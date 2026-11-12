import i18next from "i18next";
import { render as renderDOM, unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
import { initReactI18next } from "react-i18next";
import { EditorView } from "prosemirror-view";
import { ThemeProvider } from "styled-components";
import { createEditorState, p, schema } from "../../test/editor";
import theme from "../../styles/theme";
import Slideshow from "./Slideshow";

const images = [
  "https://example.com/a.png",
  "https://example.com/b.png",
  "https://example.com/c.png",
];

let container: HTMLDivElement;
let view: EditorView;

interface RenderOptions {
  /** Whether the slideshow is selected in an editable document. */
  editing?: boolean;
  /** Called when the add images button is clicked. */
  onAddImages?: () => void;
}

/**
 * Renders a slideshow. The editor view holds the same slideshow at position
 * 0, so edits made through the component can be read back from its state.
 */
function render(
  slideshowImages: string[],
  interval = 3000,
  { editing = false, onAddImages }: RenderOptions = {}
) {
  const node = schema.nodes.slideshow.create({
    images: slideshowImages,
    interval,
  });
  view.updateState(
    createEditorState(schema.nodes.doc.create(null, [node, p("")]))
  );
  act(() => {
    renderDOM(
      <ThemeProvider theme={theme}>
        <Slideshow
          theme={theme}
          view={view}
          node={node}
          isSelected={editing}
          isEditable={editing}
          getPos={() => 0}
          decorations={[]}
          onAddImages={onAddImages}
        />
      </ThemeProvider>,
      container
    );
  });
}

function dots() {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button[aria-label^='Show']")
  );
}

/** Returns the 1-based number of the dot marked as current. */
function current() {
  return dots().findIndex((dot) => dot.getAttribute("aria-current")) + 1;
}

function button(label: string) {
  const element = container.querySelector<HTMLButtonElement>(
    `button[aria-label='${label}']`
  );
  if (!element) {
    throw new Error(`No button labelled ${label}`);
  }
  return element;
}

function click(element: HTMLElement) {
  act(() => {
    element.click();
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function wrapper() {
  const element = container.querySelector<HTMLElement>("[role='group']");
  if (!element) {
    throw new Error("No slideshow rendered");
  }
  return element;
}

// Rendering needs a DOM, so this only runs in the jsdom test project.
describe.skipIf(typeof document === "undefined")("Slideshow playback", () => {
  beforeAll(async () => {
    await i18next.use(initReactI18next).init({ lng: "en", resources: {} });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    view = new EditorView(document.createElement("div"), {
      state: createEditorState(schema.nodes.doc.create(null, [p("")])),
    });
  });

  afterEach(() => {
    act(() => {
      unmountComponentAtNode(container);
    });
    view.destroy();
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows a labelled dot for each image with the first current", () => {
    render(images);

    expect(dots().map((dot) => dot.getAttribute("aria-label"))).toEqual([
      "Show image 1 of 3",
      "Show image 2 of 3",
      "Show image 3 of 3",
    ]);
    expect(current()).toBe(1);
    expect(dots().filter((dot) => dot.hasAttribute("aria-current"))).toEqual([
      dots()[0],
    ]);
  });

  it("jumps to an image when its dot is clicked", () => {
    render(images);
    click(dots()[2]);

    expect(current()).toBe(3);
  });

  it("wraps around with the previous and next controls", () => {
    render(images);

    click(button("Previous image"));
    expect(current()).toBe(3);

    click(button("Next image"));
    expect(current()).toBe(1);
  });

  it("auto-advances after each interval and loops", () => {
    render(images, 2000);

    advance(2000);
    expect(current()).toBe(2);
    advance(2000);
    expect(current()).toBe(3);
    advance(2000);
    expect(current()).toBe(1);
  });

  it("restarts the interval after manual navigation", () => {
    render(images, 2000);

    advance(1500);
    click(button("Next image"));
    expect(current()).toBe(2);

    // The old timer would have fired here.
    advance(1000);
    expect(current()).toBe(2);
    advance(1000);
    expect(current()).toBe(3);
  });

  it("pauses while the pointer is over the slideshow", () => {
    render(images, 2000);

    act(() => {
      wrapper().dispatchEvent(
        new MouseEvent("pointerover", { bubbles: true, relatedTarget: null })
      );
    });
    advance(6000);
    expect(current()).toBe(1);

    act(() => {
      wrapper().dispatchEvent(
        new MouseEvent("pointerout", { bubbles: true, relatedTarget: null })
      );
    });
    advance(2000);
    expect(current()).toBe(2);
  });

  it("pauses while a control has keyboard focus", () => {
    render(images, 2000);

    act(() => {
      dots()[0].focus();
    });
    advance(6000);
    expect(current()).toBe(1);

    act(() => {
      dots()[0].blur();
    });
    advance(2000);
    expect(current()).toBe(2);
  });

  it("does not auto-advance when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(images, 2000);

    advance(6000);
    expect(current()).toBe(1);

    click(button("Next image"));
    expect(current()).toBe(2);
  });

  it("hides the controls for a single image", () => {
    render(images.slice(0, 1));

    expect(dots()).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("keeps showing the same image when it is reordered", () => {
    render(images);
    click(dots()[1]);

    render([images[1], images[0], images[2]]);
    expect(current()).toBe(1);
  });

  it("stays on a valid image when the showing image is removed", () => {
    render(images);
    click(dots()[2]);

    render(images.slice(0, 2));
    expect(current()).toBe(2);
  });

  it("plays multiple slideshows independently", () => {
    render(images, 2000);
    const second = document.createElement("div");
    document.body.appendChild(second);
    const node = schema.nodes.slideshow.create({ images, interval: 5000 });
    act(() => {
      renderDOM(
        <ThemeProvider theme={theme}>
          <Slideshow
            theme={theme}
            view={view}
            node={node}
            isSelected={false}
            isEditable={false}
            getPos={() => 0}
            decorations={[]}
          />
        </ThemeProvider>,
        second
      );
    });

    advance(2000);
    const currents = Array.from(
      document.body.querySelectorAll("[aria-current='true']")
    ).map((dot) => dot.getAttribute("aria-label"));
    expect(currents).toEqual(["Show image 2 of 3", "Show image 1 of 3"]);

    act(() => {
      unmountComponentAtNode(second);
    });
    second.remove();
  });

  describe("editing images", () => {
    function imagesInDoc() {
      return view.state.doc.firstChild?.attrs.images;
    }

    it("is only shown to editors with the slideshow selected", () => {
      render(images);
      expect(container.querySelector("ul")).toBeNull();

      render(images, 3000, { editing: true });
      expect(container.querySelectorAll("li")).toHaveLength(3);
    });

    it("removes an image", () => {
      render(images, 3000, { editing: true });
      click(button("Remove image 2"));

      expect(imagesInDoc()).toEqual([images[0], images[2]]);
    });

    it("moves an image earlier", () => {
      render(images, 3000, { editing: true });
      click(button("Move image 3 earlier"));
      expect(imagesInDoc()).toEqual([images[0], images[2], images[1]]);
    });

    it("can't move the first image earlier or the last image later", () => {
      render(images, 3000, { editing: true });

      expect(button("Move image 1 earlier").disabled).toBe(true);
      expect(button("Move image 3 later").disabled).toBe(true);
      expect(button("Move image 1 later").disabled).toBe(false);
    });

    it("shows an image when its thumbnail is clicked", () => {
      render(images, 3000, { editing: true });
      click(button("Preview image 3 of 3"));

      expect(current()).toBe(3);
    });

    it("offers to add images when uploading is available", () => {
      const onAddImages = vi.fn();
      render(images, 3000, { editing: true, onAddImages });
      const add = Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent === "Add images"
      );
      add?.click();

      expect(onAddImages).toHaveBeenCalledTimes(1);
    });

    it("keeps the editor on an empty slideshow so images can be added", () => {
      render([], 3000, { editing: true, onAddImages: vi.fn() });

      expect(container.textContent).toContain("Empty slideshow");
      expect(container.textContent).toContain("Add images");
    });
  });
});
