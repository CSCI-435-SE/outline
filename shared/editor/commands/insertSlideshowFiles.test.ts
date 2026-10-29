import { TextSelection } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import { toast } from "sonner";
import {
  createEditorState,
  extensionManager,
  findNodes,
  p,
  schema,
} from "../../test/editor";
import {
  SlideshowUploadPlugin,
  getSlideshowUploadSession,
  slideshowUploadKey,
} from "../plugins/SlideshowUploadPlugin";
import insertSlideshowFiles from "./insertSlideshowFiles";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

const serializer = extensionManager.serializer();
const parser = extensionManager.parser({
  schema,
  plugins: extensionManager.rulePlugins,
});

interface Deferred {
  resolve: (src: string) => void;
  reject: (error: Error) => void;
  onProgress?: (fraction: number) => void;
}

/**
 * Creates a minimal editor view backed by a real editor state, and an upload
 * function whose uploads are resolved manually by the test.
 */
function setup() {
  let state: EditorState = createEditorState(
    schema.nodes.doc.create(null, [p("Before"), p(""), p("After")]),
    [new SlideshowUploadPlugin()]
  );
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 9))
  );

  const view = {
    get state() {
      return state;
    },
    dispatch: (tr: Transaction) => {
      state = state.apply(tr);
    },
    isDestroyed: false,
  };
  const uploads: Deferred[] = [];
  const options = {
    uploadFile: vi.fn(
      (
        _file: File | string,
        uploadOptions?: { onProgress?: (fraction: number) => void }
      ) =>
        new Promise<string>((resolve, reject) => {
          uploads.push({
            resolve,
            reject,
            onProgress: uploadOptions?.onProgress,
          });
        })
    ),
    onFileUploadStart: vi.fn(),
    onFileUploadStop: vi.fn(),
  };

  const slideshow = () => findNodes(state.doc.toJSON(), "slideshow")[0];
  const session = () =>
    getSlideshowUploadSession(slideshowUploadKey.getState(state)?.find() ?? []);

  return { view, uploads, options, slideshow, session };
}

const image = (name: string) => new File(["x"], name, { type: "image/png" });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("insertSlideshowFiles", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("inserts a slideshow and uploads each image", () => {
    const { view, uploads, options, slideshow, session } = setup();

    insertSlideshowFiles(view, [image("a.png"), image("b.png")], options);

    expect(slideshow()?.attrs?.images).toEqual([]);
    expect(options.uploadFile).toHaveBeenCalledTimes(2);
    expect(uploads).toHaveLength(2);
    expect(session()?.items.map((item) => item.file.name)).toEqual([
      "a.png",
      "b.png",
    ]);
    expect(options.onFileUploadStart).toHaveBeenCalledTimes(1);
  });

  it("skips files that aren't images", () => {
    const { view, options, session } = setup();
    const text = new File(["x"], "notes.txt", { type: "text/plain" });

    insertSlideshowFiles(view, [text, image("a.png")], options);

    expect(session()?.items).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no images are selected", () => {
    const { view, options, slideshow } = setup();
    const text = new File(["x"], "notes.txt", { type: "text/plain" });

    expect(insertSlideshowFiles(view, [text], options)).toBeUndefined();
    expect(slideshow()).toBeUndefined();
    expect(options.uploadFile).not.toHaveBeenCalled();
  });

  it("reports progress on each image", async () => {
    const { view, uploads, options, session } = setup();

    insertSlideshowFiles(view, [image("a.png")], options);
    uploads[0].onProgress?.(0.5);
    await flush();

    expect(session()?.items[0].progress).toBe(0.5);
    expect(session()?.items[0].status).toBe("uploading");
  });

  it("keeps the selected order when uploads finish out of order", async () => {
    const { view, uploads, options, slideshow, session } = setup();

    insertSlideshowFiles(
      view,
      [image("a.png"), image("b.png"), image("c.png")],
      options
    );

    uploads[2].resolve("/api/attachments.redirect?id=c");
    await flush();
    expect(slideshow()?.attrs?.images).toEqual([
      "/api/attachments.redirect?id=c",
    ]);

    uploads[0].resolve("/api/attachments.redirect?id=a");
    uploads[1].resolve("/api/attachments.redirect?id=b");
    await flush();

    expect(slideshow()?.attrs?.images).toEqual([
      "/api/attachments.redirect?id=a",
      "/api/attachments.redirect?id=b",
      "/api/attachments.redirect?id=c",
    ]);
    expect(session()).toBeUndefined();
    expect(options.onFileUploadStop).toHaveBeenCalledTimes(1);
  });

  it("persists uploaded images through markdown", async () => {
    const { view, uploads, options } = setup();

    insertSlideshowFiles(view, [image("a.png"), image("b.png")], options);
    uploads[0].resolve("/api/attachments.redirect?id=a");
    uploads[1].resolve("/api/attachments.redirect?id=b");
    await flush();

    const markdown = serializer.serialize(view.state.doc);
    expect(markdown).toContain(`:::slideshow 3000
![](/api/attachments.redirect?id=a)
![](/api/attachments.redirect?id=b)
:::`);
    expect(parser.parse(markdown)?.toJSON()).toEqual(view.state.doc.toJSON());
  });

  it("keeps failed uploads so they can be retried", async () => {
    const { view, uploads, options, slideshow, session } = setup();

    insertSlideshowFiles(view, [image("a.png"), image("b.png")], options);
    uploads[0].reject(new Error("File too large"));
    uploads[1].resolve("/api/attachments.redirect?id=b");
    await flush();

    expect(slideshow()?.attrs?.images).toEqual([
      "/api/attachments.redirect?id=b",
    ]);
    expect(session()?.items.map((item) => item.status)).toEqual([
      "error",
      "done",
    ]);
    expect(session()?.items[0].error).toBe("File too large");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(options.onFileUploadStop).toHaveBeenCalledTimes(1);

    session()?.retry(session()?.items[0].id ?? "");
    expect(session()?.items[0].status).toBe("uploading");
    expect(options.onFileUploadStart).toHaveBeenCalledTimes(2);

    uploads[2].resolve("/api/attachments.redirect?id=a");
    await flush();

    expect(slideshow()?.attrs?.images).toEqual([
      "/api/attachments.redirect?id=a",
      "/api/attachments.redirect?id=b",
    ]);
    expect(session()).toBeUndefined();
  });

  it("removes a failed upload when dismissed", async () => {
    const { view, uploads, options, slideshow, session } = setup();

    insertSlideshowFiles(view, [image("a.png"), image("b.png")], options);
    uploads[0].resolve("/api/attachments.redirect?id=a");
    uploads[1].reject(new Error("Network error"));
    await flush();

    session()?.dismiss(session()?.items[1].id ?? "");

    expect(session()).toBeUndefined();
    expect(slideshow()?.attrs?.images).toEqual([
      "/api/attachments.redirect?id=a",
    ]);
  });

  it("treats an unusable upload url as a failure", async () => {
    const { view, uploads, options, slideshow, session } = setup();

    insertSlideshowFiles(view, [image("a.png")], options);
    uploads[0].resolve("javascript:alert(1)");
    await flush();

    expect(slideshow()?.attrs?.images).toEqual([]);
    expect(session()?.items[0].status).toBe("error");
  });

  it("stops tracking uploads when the slideshow is deleted", async () => {
    const { view, uploads, options, slideshow, session } = setup();

    insertSlideshowFiles(view, [image("a.png")], options);
    const { from, to } = findSlideshow(view.state);
    view.dispatch(view.state.tr.delete(from, to));
    expect(session()).toBeUndefined();

    uploads[0].resolve("/api/attachments.redirect?id=a");
    await flush();

    expect(slideshow()).toBeUndefined();
    expect(options.onFileUploadStop).toHaveBeenCalledTimes(1);
  });
});

function findSlideshow(state: EditorState) {
  let range = { from: 0, to: 0 };
  state.doc.descendants((node, pos) => {
    if (node.type.name === "slideshow") {
      range = { from: pos, to: pos + node.nodeSize };
    }
  });
  return range;
}
