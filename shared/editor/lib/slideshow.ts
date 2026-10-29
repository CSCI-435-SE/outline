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
