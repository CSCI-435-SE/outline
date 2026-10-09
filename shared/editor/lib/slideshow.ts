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
