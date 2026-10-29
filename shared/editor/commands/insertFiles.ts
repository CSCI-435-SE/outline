import * as Sentry from "@sentry/react";
import { t } from "i18next";
import { v4 as uuidv4 } from "uuid";
import type { EditorView } from "prosemirror-view";
import { toast } from "sonner";
import FileHelper from "../lib/FileHelper";
import uploadPlaceholderPlugin, {
  findPlaceholder,
} from "../lib/uploadPlaceholder";
import {
  imageRowLayoutClass,
  prepareImageRow,
} from "../plugins/SideBySideImagesPlugin";

export type Options = {
  /** Set to true to force images and videos to become file attachments */
  isAttachment?: boolean;
  /** Set to true to replace any existing image at the users selection */
  replaceExisting?: boolean;
  /** Callback fired to upload a file */
  uploadFile?: (
    file: File | string,
    options?: {
      id?: string;
      onProgress?: (fractionComplete: number) => void;
    }
  ) => Promise<string>;
  /** Callback fired when the user starts a file upload */
  onFileUploadStart?: () => void;
  /** Callback fired when the user completes a file upload */
  onFileUploadStop?: () => void;
  /** Callback fired when file upload progress changes */
  onFileUploadProgress?: (id: string, fractionComplete: number) => void;
  /** Attributes to overwrite */
  attrs?: {
    /** Width to use when inserting image */
    width?: number;
    /** Height to use when inserting image */
    height?: number;
    /** Alt text / caption to use when inserting image */
    alt?: string | null;
    /** Layout class for alignment when inserting image */
    layoutClass?: string | null;
    /** Whether to show a PDF preview embed for attachment nodes */
    preview?: boolean;
  };
};

const insertFiles = async function (
  view: EditorView,
  event:
    | Event
    | React.ChangeEvent<HTMLInputElement>
    | React.DragEvent<HTMLDivElement>,
  pos: number,
  files: File[],
  options: Options
) {
  const {
    uploadFile,
    onFileUploadStart,
    onFileUploadStop,
    onFileUploadProgress,
  } = options;

  // okay, we have some dropped files and a handler – lets stop this
  // event going any further up the stack
  event.preventDefault();

  // let the user know we're starting to process the files
  onFileUploadStart?.();

  const { schema } = view.state;

  // we'll use this to track of how many files have succeeded or failed
  let complete = 0;

  const filesToUpload = (
    await Promise.all(
      files.map(async (file) => {
        const isImage =
          FileHelper.isImage(file.type) &&
          !options.isAttachment &&
          !!schema.nodes.image;
        const isVideo =
          FileHelper.isVideo(file.type) &&
          !options.isAttachment &&
          !!schema.nodes.video;

        // a file that cannot be inserted as an image or video falls back to an
        // attachment node – if the schema in use has none then it cannot be
        // represented at all and should be skipped.
        if (!isImage && !isVideo && !schema.nodes.attachment) {
          return undefined;
        }

        const getDimensions = isImage
          ? (f: File) => FileHelper.getImageDimensions(f)
          : isVideo
            ? (f: File) => FileHelper.getVideoDimensions(f)
            : undefined;

        return {
          id: uuidv4(),
          dimensions: await getDimensions?.(file),
          source: await FileHelper.getImageSourceAttr(file),
          isImage,
          isVideo,
          file,
        };
      })
    )
  ).filter((upload) => upload !== undefined);

  // none of the dropped files can be represented in this schema, nothing to do
  if (filesToUpload.length === 0) {
    onFileUploadStop?.();
    return;
  }

  // multiple images inserted together are placed side by side in a row
  const rowPos =
    filesToUpload.length > 1 &&
    filesToUpload.every((upload) => upload.isImage) &&
    !options.replaceExisting &&
    !options.attrs?.layoutClass
      ? prepareRow(view, pos)
      : undefined;
  const isRow = rowPos !== undefined;
  const rowAttrs = isRow ? { layoutClass: imageRowLayoutClass } : undefined;

  // images in a row are inserted in the order they were selected, so each one
  // waits for the image before it even though the uploads run in parallel.
  let previousInsert: Promise<unknown> = Promise.resolve();

  // the user might have dropped multiple files at once, we need to loop
  for (const upload of filesToUpload) {
    const { tr } = view.state;

    tr.setMeta(uploadPlaceholderPlugin, {
      add: {
        pos: rowPos ?? pos,
        ...upload,
        replaceExisting: options.replaceExisting,
        rowSize: isRow ? filesToUpload.length : undefined,
      },
    });
    view.dispatch(tr);

    // start uploading the file to the server. Using "then" syntax
    // to allow all placeholders to be entered at once with the uploads
    // happening in the background in parallel.
    const uploading = uploadFile?.(upload.file, {
      id: upload.id,
      onProgress: (progress) => onFileUploadProgress?.(upload.id, progress),
    });
    if (!uploading) {
      continue;
    }

    const inserting = Promise.all([
      uploading,
      isRow ? previousInsert : undefined,
    ])
      // then this should be able to get the full URL as well
      .then(async ([src]) => {
        if (view.isDestroyed) {
          return;
        }
        if (upload.isImage) {
          await loadImage(src);

          const result = findPlaceholder(view.state, upload.id);
          if (result === null) {
            return;
          }

          if (view.isDestroyed) {
            return;
          }

          const [from, to] = result;
          view.dispatch(
            view.state.tr
              .replaceWith(
                from,
                to || from,
                schema.nodes.image.create({
                  src,
                  source: upload.source,
                  ...upload.dimensions,
                  ...rowAttrs,
                  ...options.attrs,
                })
              )
              .setMeta(uploadPlaceholderPlugin, { remove: { id: upload.id } })
          );
        } else if (upload.isVideo) {
          const result = findPlaceholder(view.state, upload.id);
          if (result === null) {
            return;
          }

          const [from, to] = result;

          if (view.isDestroyed) {
            return;
          }

          view.dispatch(
            view.state.tr
              .replaceWith(
                from,
                to || from,
                schema.nodes.video.create({
                  src,
                  title: upload.file.name ?? t("Untitled"),
                  ...upload.dimensions,
                  ...options.attrs,
                })
              )
              .setMeta(uploadPlaceholderPlugin, { remove: { id: upload.id } })
          );
        } else {
          const result = findPlaceholder(view.state, upload.id);
          if (result === null) {
            return;
          }

          const [from, to] = result;

          view.dispatch(
            view.state.tr
              .replaceWith(
                from,
                to || from,
                schema.nodes.attachment.create({
                  href: src,
                  title: upload.file.name ?? t("Untitled"),
                  size: upload.file.size,
                  contentType: upload.file.type,
                  preview: false,
                  ...options.attrs,
                })
              )
              .setMeta(uploadPlaceholderPlugin, { remove: { id: upload.id } })
          );
        }
      })
      .catch((error) => {
        Sentry.captureException(error);

        // oxlint-disable-next-line no-console
        console.error(error);

        if (view.isDestroyed) {
          return;
        }

        // cleanup the placeholder if there is a failure
        view.dispatch(
          view.state.tr.setMeta(uploadPlaceholderPlugin, {
            remove: { id: upload.id },
          })
        );

        toast.error(
          error.message || t("Sorry, an error occurred uploading the file")
        );
      })
      .finally(() => {
        complete++;

        // once everything is done, let the user know
        if (complete === filesToUpload.length && onFileUploadStop) {
          onFileUploadStop();
        }
      });

    previousInsert = inserting;
  }
};

/**
 * Prepares a position to insert a row of images at, inserting an empty
 * paragraph into the document if one is needed.
 *
 * @param view the editor view.
 * @param pos the position the files were requested at.
 * @returns the position to insert the row at, or undefined if the images
 * cannot be placed in a row here.
 */
function prepareRow(view: EditorView, pos: number): number | undefined {
  const { tr } = view.state;
  const rowPos = prepareImageRow(tr, pos);
  if (rowPos !== undefined && tr.docChanged) {
    view.dispatch(tr);
  }
  return rowPos;
}

/**
 * Loads an image so that it is ready to display once inserted.
 *
 * @param src the image source.
 * @returns a promise that resolves once the image has loaded.
 * @throws if the image fails to load.
 */
function loadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Error loading image: ${src}`));
    img.src = src;
  });
}

export default insertFiles;
