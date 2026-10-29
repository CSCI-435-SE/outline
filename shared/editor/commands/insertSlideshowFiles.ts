import * as Sentry from "@sentry/react";
import { t } from "i18next";
import type { Node as ProsemirrorNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { AttachmentValidation } from "../../validations";
import type { SlideshowUploadItem } from "../lib/slideshow";
import {
  DEFAULT_SLIDESHOW_INTERVAL,
  getUploadedSlideshowImages,
  isSlideshowImageUrl,
} from "../lib/slideshow";
import type { SlideshowUploadAction } from "../plugins/SlideshowUploadPlugin";
import {
  findSlideshowUpload,
  slideshowUploadKey,
} from "../plugins/SlideshowUploadPlugin";
import type { Options } from "./insertFiles";

/** The parts of the editor view needed to upload into a slideshow. */
export type SlideshowUploadView = Pick<
  EditorView,
  "state" | "dispatch" | "isDestroyed"
>;

/** Options for uploading images into a new slideshow. */
export type SlideshowUploadOptions = Pick<
  Options,
  "onFileUploadStart" | "onFileUploadStop" | "onFileUploadProgress"
> & {
  /** Callback fired to upload a file, resolving to its attachment URL. */
  uploadFile: NonNullable<Options["uploadFile"]>;
};

/**
 * Inserts a slideshow at the current selection and uploads the given images
 * into it through attachment storage. Each image shows its progress in the
 * slideshow while uploading, and images that fail to upload can be retried or
 * removed. Uploaded images are shown in the order the files were selected.
 *
 * @param view the editor view.
 * @param files the files selected by the user.
 * @param options callbacks to upload files and report progress.
 * @returns the id of the upload session, or undefined if no images were selected.
 */
export default function insertSlideshowFiles(
  view: SlideshowUploadView,
  files: File[],
  options: SlideshowUploadOptions
): string | undefined {
  const images = files.filter((file) =>
    AttachmentValidation.imageContentTypes.includes(file.type)
  );

  if (images.length < files.length) {
    toast.error(
      images.length
        ? t("Some files were skipped because they aren’t images")
        : t("Choose one or more image files")
    );
  }
  if (!images.length) {
    return undefined;
  }

  const { state } = view;
  const { slideshow } = state.schema.nodes;
  const node = slideshow.create({
    images: [],
    interval: DEFAULT_SLIDESHOW_INTERVAL,
  });
  const tr = state.tr.replaceSelectionWith(node);
  const pos = findInsertedNode(tr.doc, node);
  if (pos === undefined) {
    return undefined;
  }

  const sessionId = uuidv4();
  let items: SlideshowUploadItem[] = images.map((file) => ({
    id: uuidv4(),
    file,
    previewUrl: createPreviewUrl(file),
    progress: 0,
    status: "uploading",
  }));
  let pending = 0;
  let finished = false;

  const session = () => ({ id: sessionId, items, retry, dismiss });

  const dispatchAction = (action: SlideshowUploadAction) => {
    if (view.isDestroyed) {
      return;
    }
    view.dispatch(
      view.state.tr
        .setMeta(slideshowUploadKey, action)
        .setMeta("addToHistory", false)
    );
  };

  const finish = () => {
    finished = true;
    items.forEach((item) => revokePreviewUrl(item.previewUrl));
    dispatchAction({ remove: sessionId });
  };

  const updateItem = (id: string, changes: Partial<SlideshowUploadItem>) => {
    items = items.map((item) =>
      item.id === id ? { ...item, ...changes } : item
    );
  };

  // Write the finished images to the node, so they are saved with the
  // document even while other images are still uploading.
  const writeImages = () => {
    if (view.isDestroyed) {
      return;
    }
    const range = findSlideshowUpload(view.state, sessionId);
    if (!range) {
      return;
    }
    view.dispatch(
      view.state.tr
        .setNodeAttribute(
          range.from,
          "images",
          getUploadedSlideshowImages(items)
        )
        .setMeta("addToHistory", false)
    );
  };

  const settle = () => {
    // Once every image has uploaded there is nothing more to show.
    if (items.every((item) => item.status === "done")) {
      finish();
      return;
    }
    dispatchAction({ update: session() });
  };

  const upload = (item: SlideshowUploadItem) => {
    if (pending++ === 0) {
      options.onFileUploadStart?.();
    }

    // A fresh id per attempt, as it is used as the attachment id.
    const attemptId = uuidv4();
    let lastProgress = 0;

    options
      .uploadFile(item.file, {
        id: attemptId,
        onProgress: (progress) => {
          options.onFileUploadProgress?.(attemptId, progress);

          // Avoid a transaction for every progress event.
          if (finished || progress - lastProgress < 0.05) {
            return;
          }
          lastProgress = progress;
          updateItem(item.id, { progress });
          dispatchAction({ update: session() });
        },
      })
      .then((src) => {
        if (!isSlideshowImageUrl(src)) {
          throw new Error(t("The uploaded image link isn’t supported"));
        }
        if (finished) {
          return;
        }
        updateItem(item.id, { status: "done", progress: 1, src });
        writeImages();
      })
      .catch((error: unknown) => {
        Sentry.captureException(error);
        if (finished) {
          return;
        }

        const message =
          error instanceof Error && error.message
            ? error.message
            : t("Sorry, an error occurred uploading the file");
        updateItem(item.id, { status: "error", error: message });
        toast.error(
          t("Couldn’t upload “{{ fileName }}”", { fileName: item.file.name }),
          { description: message }
        );
      })
      .finally(() => {
        if (--pending === 0) {
          options.onFileUploadStop?.();
        }
        if (finished) {
          return;
        }
        // The editor closed or the slideshow was deleted, stop tracking it.
        if (view.isDestroyed || !findSlideshowUpload(view.state, sessionId)) {
          finish();
          return;
        }
        settle();
      });
  };

  function retry(itemId: string) {
    const item = items.find(
      (candidate) => candidate.id === itemId && candidate.status === "error"
    );
    if (!item || finished) {
      return;
    }
    updateItem(itemId, { status: "uploading", progress: 0, error: undefined });
    dispatchAction({ update: session() });
    upload(item);
  }

  function dismiss(itemId: string) {
    const item = items.find(
      (candidate) => candidate.id === itemId && candidate.status === "error"
    );
    if (!item || finished) {
      return;
    }
    revokePreviewUrl(item.previewUrl);
    items = items.filter((candidate) => candidate.id !== itemId);
    settle();
  }

  view.dispatch(
    tr
      .setMeta(slideshowUploadKey, { add: { pos, session: session() } })
      .scrollIntoView()
  );
  items.forEach(upload);

  return sessionId;
}

/**
 * Finds the position of a node that was just inserted into the document.
 *
 * @param doc the document after the insert.
 * @param node the inserted node.
 * @returns the position before the node, or undefined if it wasn't found.
 */
function findInsertedNode(
  doc: ProsemirrorNode,
  node: ProsemirrorNode
): number | undefined {
  let found: number | undefined;
  doc.descendants((child, pos) => {
    if (found !== undefined) {
      return false;
    }
    if (child === node) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

function createPreviewUrl(file: File): string {
  return typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : "";
}

function revokePreviewUrl(url: string) {
  if (url && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}
