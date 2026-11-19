import { isUrl } from "../../utils/urls";

/** The default time each slideshow image is shown for, in milliseconds. */
export const DEFAULT_SLIDESHOW_INTERVAL = 3000;

/** The shortest allowed time each slideshow image is shown for, in milliseconds. */
export const MIN_SLIDESHOW_INTERVAL = 500;

/** The attributes stored on a slideshow node. */
export interface SlideshowAttrs {
  /** The image URLs in the order they are shown. */
  images: string[];
  /** The time each image is shown for, in milliseconds. */
  interval: number;
}

/**
 * Returns whether the given string can be used as a slideshow image source,
 * either an absolute http(s) URL or a path on the current host such as an
 * attachment redirect.
 *
 * @param value the candidate image source.
 * @returns true if the value is a usable image source.
 */
export function isSlideshowImageUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }
  if (!isUrl(value)) {
    return false;
  }
  const { protocol } = new URL(value);
  return protocol === "http:" || protocol === "https:";
}

/**
 * Extracts the image URLs from free text entered by the user, separated by
 * whitespace or commas. Values that are not usable image URLs are ignored.
 *
 * @param input the text containing one or more image URLs.
 * @returns the valid image URLs, in the order they were entered.
 */
export function parseSlideshowUrls(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => value && isSlideshowImageUrl(value));
}

/**
 * Normalizes untrusted attribute values into valid slideshow attributes,
 * dropping invalid image URLs and falling back to the default interval.
 *
 * @param attrs the untrusted attributes, e.g. from a command or parsed HTML.
 * @returns valid slideshow attributes.
 */
export function toSlideshowAttrs(attrs: unknown): SlideshowAttrs {
  const record: Record<string, unknown> =
    attrs && typeof attrs === "object" ? { ...attrs } : {};
  const images = Array.isArray(record.images)
    ? record.images.filter(
        (image): image is string =>
          typeof image === "string" && isSlideshowImageUrl(image)
      )
    : [];
  const interval = Number(record.interval);

  return {
    images,
    interval:
      Number.isFinite(interval) && interval >= MIN_SLIDESHOW_INTERVAL
        ? Math.round(interval)
        : DEFAULT_SLIDESHOW_INTERVAL,
  };
}

/** The transition intervals offered in the toolbar, in milliseconds. */
export const SLIDESHOW_INTERVALS = [2000, 3000, 5000, 8000, 10000];

/**
 * Formats a slideshow interval as a short duration in seconds, e.g. "3s".
 *
 * @param interval the interval in milliseconds.
 * @param locale the locale to format the number in, defaults to the runtime locale.
 * @returns the formatted duration.
 */
export function formatSlideshowInterval(
  interval: number,
  locale?: string
): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "second",
    unitDisplay: "narrow",
    maximumFractionDigits: 1,
  }).format(interval / 1000);
}

/** The state of a single image being uploaded into a slideshow. */
export interface SlideshowUploadItem {
  /** A unique id for the item, stable across retries. */
  id: string;
  /** The file being uploaded. */
  file: File;
  /** A local URL used to preview the image while it uploads. */
  previewUrl: string;
  /** The fraction of the upload that is complete, between 0 and 1. */
  progress: number;
  /** Whether the upload is in progress, finished or failed. */
  status: "uploading" | "done" | "error";
  /** The URL returned by attachment storage once the upload is done. */
  src?: string;
  /** A message describing why the upload failed. */
  error?: string;
}

/**
 * Returns the image URLs of the finished uploads, in the order the files were
 * selected rather than the order the uploads completed.
 *
 * @param items the upload items, in the order the files were selected.
 * @returns the uploaded image URLs.
 */
export function getUploadedSlideshowImages(
  items: readonly SlideshowUploadItem[]
): string[] {
  return items
    .map((item) => (item.status === "done" ? item.src : undefined))
    .filter((src): src is string => !!src);
}

/**
 * Returns a new image list with the given images added to the end. Values
 * that are not usable image URLs are ignored.
 *
 * @param images the current image URLs.
 * @param additions the image URLs to add.
 * @returns the updated image URLs.
 */
export function addSlideshowImages(
  images: readonly string[],
  additions: readonly string[]
): string[] {
  return [...images, ...additions.filter(isSlideshowImageUrl)];
}

/**
 * Returns a new image list without the image at the given index. Removing the
 * last image leaves an empty list rather than removing the slideshow.
 *
 * @param images the current image URLs.
 * @param index the index of the image to remove.
 * @returns the updated image URLs, or undefined if the index is out of range.
 */
export function removeSlideshowImage(
  images: readonly string[],
  index: number
): string[] | undefined {
  if (!isValidIndex(images, index)) {
    return undefined;
  }
  return images.filter((_, i) => i !== index);
}

/**
 * Returns a new image list with the image at one index moved to another,
 * shifting the images in between.
 *
 * @param images the current image URLs.
 * @param from the index of the image to move.
 * @param to the index the image should end up at.
 * @returns the updated image URLs, or undefined if either index is out of
 * range or the image would not move.
 */
export function moveSlideshowImage(
  images: readonly string[],
  from: number,
  to: number
): string[] | undefined {
  if (!isValidIndex(images, from) || !isValidIndex(images, to) || from === to) {
    return undefined;
  }
  const next = [...images];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Wraps an index into the range of a slideshow, so stepping past the last
 * image returns to the first and stepping before the first goes to the last.
 *
 * @param index the index to wrap, which may be negative or past the end.
 * @param count the number of images in the slideshow.
 * @returns a valid index, or 0 for an empty slideshow.
 */
export function wrapSlideshowIndex(index: number, count: number): number {
  if (count <= 0 || !Number.isInteger(index)) {
    return 0;
  }
  return ((index % count) + count) % count;
}

/**
 * Works out which image to show after the image list changes, so playback
 * continues from a valid image. The image that was showing stays on screen
 * if it is still in the list, even if it moved. If it was removed, the image
 * that took its place is shown, or the last image if it was at the end.
 *
 * @param previous the image URLs before the change.
 * @param next the image URLs after the change.
 * @param activeIndex the index that was showing before the change.
 * @returns the index to show in the new list, or 0 for an empty slideshow.
 */
export function getSlideshowIndexAfterChange(
  previous: readonly string[],
  next: readonly string[],
  activeIndex: number
): number {
  if (!next.length) {
    return 0;
  }

  const src = previous[activeIndex];
  if (src !== undefined) {
    // The same image may appear more than once, prefer the copy that has
    // stayed in place, then the nearest one.
    if (next[activeIndex] === src) {
      return activeIndex;
    }
    let nearest: number | undefined;
    next.forEach((candidate, index) => {
      if (
        candidate === src &&
        (nearest === undefined ||
          Math.abs(index - activeIndex) < Math.abs(nearest - activeIndex))
      ) {
        nearest = index;
      }
    });
    if (nearest !== undefined) {
      return nearest;
    }
  }

  return Math.min(Math.max(activeIndex, 0), next.length - 1);
}

/**
 * Updates a slideshow's image list with the latest finished uploads. The
 * uploads written last time are taken out and the current uploads are added
 * to the end, so the images already in the slideshow, and any edits made
 * while uploading, are kept.
 *
 * @param current the image URLs currently on the slideshow.
 * @param previous the uploaded image URLs that were written last time.
 * @param uploaded the uploaded image URLs to write now, in selection order.
 * @returns the updated image URLs.
 */
export function mergeSlideshowUploads(
  current: readonly string[],
  previous: readonly string[],
  uploaded: readonly string[]
): string[] {
  const base = [...current];
  // Search from the end, as the uploads were added after the existing images.
  for (const src of [...previous].reverse()) {
    const index = base.lastIndexOf(src);
    if (index !== -1) {
      base.splice(index, 1);
    }
  }
  return [...base, ...uploaded];
}

function isValidIndex(images: readonly string[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < images.length;
}
