import type { SlideshowUploadItem } from "./slideshow";
import {
  DEFAULT_SLIDESHOW_INTERVAL,
  SLIDESHOW_INTERVALS,
  addSlideshowImages,
  formatSlideshowInterval,
  getSlideshowIndexAfterChange,
  getUploadedSlideshowImages,
  isSlideshowImageUrl,
  mergeSlideshowUploads,
  moveSlideshowImage,
  parseSlideshowUrls,
  removeSlideshowImage,
  toSlideshowAttrs,
  wrapSlideshowIndex,
} from "./slideshow";

describe("isSlideshowImageUrl", () => {
  it("accepts http(s) urls and local paths", () => {
    expect(isSlideshowImageUrl("https://example.com/a.png")).toBe(true);
    expect(isSlideshowImageUrl("http://example.com/a.png")).toBe(true);
    expect(isSlideshowImageUrl("/api/attachments.redirect?id=1")).toBe(true);
  });

  it("rejects unsafe or invalid values", () => {
    expect(isSlideshowImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSlideshowImageUrl("data:image/png;base64,abc")).toBe(false);
    expect(isSlideshowImageUrl("//evil.com/a.png")).toBe(false);
    expect(isSlideshowImageUrl("not a url")).toBe(false);
  });
});

describe("parseSlideshowUrls", () => {
  it("splits on whitespace and commas, keeping order", () => {
    expect(
      parseSlideshowUrls(
        "https://a.com/1.png, https://a.com/2.png\nhttps://a.com/3.png"
      )
    ).toEqual([
      "https://a.com/1.png",
      "https://a.com/2.png",
      "https://a.com/3.png",
    ]);
  });

  it("ignores invalid entries", () => {
    expect(parseSlideshowUrls("hello https://a.com/1.png ftp://x")).toEqual([
      "https://a.com/1.png",
    ]);
    expect(parseSlideshowUrls("   ")).toEqual([]);
  });
});

describe("toSlideshowAttrs", () => {
  it("falls back to defaults for invalid input", () => {
    expect(toSlideshowAttrs(undefined)).toEqual({
      images: [],
      interval: DEFAULT_SLIDESHOW_INTERVAL,
    });
    expect(
      toSlideshowAttrs({ images: ["https://a.com/1.png", 5], interval: 10 })
    ).toEqual({
      images: ["https://a.com/1.png"],
      interval: DEFAULT_SLIDESHOW_INTERVAL,
    });
  });

  it("parses numeric string intervals", () => {
    expect(toSlideshowAttrs({ interval: "4500" }).interval).toBe(4500);
  });
});

describe("formatSlideshowInterval", () => {
  it("formats milliseconds as seconds", () => {
    expect(formatSlideshowInterval(3000, "en")).toBe("3s");
    expect(formatSlideshowInterval(4500, "en")).toBe("4.5s");
  });

  it("offers the default interval as an option", () => {
    expect(SLIDESHOW_INTERVALS).toContain(DEFAULT_SLIDESHOW_INTERVAL);
    expect(
      SLIDESHOW_INTERVALS.every(
        (interval) => toSlideshowAttrs({ interval }).interval === interval
      )
    ).toBe(true);
  });
});

describe("getUploadedSlideshowImages", () => {
  const item = (
    id: string,
    status: SlideshowUploadItem["status"],
    src?: string
  ): SlideshowUploadItem => ({
    id,
    file: new File(["x"], `${id}.png`, { type: "image/png" }),
    previewUrl: "",
    progress: status === "done" ? 1 : 0,
    status,
    src,
  });

  it("returns finished uploads in the selected order", () => {
    expect(
      getUploadedSlideshowImages([
        item("a", "done", "/a"),
        item("b", "error"),
        item("c", "uploading"),
        item("d", "done", "/d"),
      ])
    ).toEqual(["/a", "/d"]);
  });
});

const a = "https://example.com/a.png";
const b = "https://example.com/b.png";
const c = "https://example.com/c.png";
const d = "https://example.com/d.png";

describe("addSlideshowImages", () => {
  it("adds images to the end in order", () => {
    expect(addSlideshowImages([a], [b, c])).toEqual([a, b, c]);
  });

  it("adds to an empty slideshow", () => {
    expect(addSlideshowImages([], [a])).toEqual([a]);
  });

  it("ignores unusable urls", () => {
    expect(addSlideshowImages([a], ["javascript:alert(1)", b])).toEqual([a, b]);
  });

  it("does not change the original list", () => {
    const images = [a];
    addSlideshowImages(images, [b]);
    expect(images).toEqual([a]);
  });
});

describe("removeSlideshowImage", () => {
  it("removes the image at the index", () => {
    expect(removeSlideshowImage([a, b, c], 1)).toEqual([a, c]);
  });

  it("removes only the chosen copy of a repeated image", () => {
    expect(removeSlideshowImage([a, b, a], 2)).toEqual([a, b]);
  });

  it("leaves an empty list when removing the last image", () => {
    expect(removeSlideshowImage([a], 0)).toEqual([]);
  });

  it("returns undefined for an index out of range", () => {
    expect(removeSlideshowImage([a, b], 2)).toBeUndefined();
    expect(removeSlideshowImage([a, b], -1)).toBeUndefined();
    expect(removeSlideshowImage([a, b], 0.5)).toBeUndefined();
    expect(removeSlideshowImage([], 0)).toBeUndefined();
  });
});

describe("moveSlideshowImage", () => {
  it("moves an image to the front", () => {
    expect(moveSlideshowImage([a, b, c, d], 3, 0)).toEqual([d, a, b, c]);
  });

  it("moves an image to the end", () => {
    expect(moveSlideshowImage([a, b, c, d], 0, 3)).toEqual([b, c, d, a]);
  });

  it("swaps neighbouring images", () => {
    expect(moveSlideshowImage([a, b, c], 1, 2)).toEqual([a, c, b]);
    expect(moveSlideshowImage([a, b, c], 1, 0)).toEqual([b, a, c]);
  });

  it("returns undefined when nothing would move", () => {
    expect(moveSlideshowImage([a, b], 1, 1)).toBeUndefined();
  });

  it("returns undefined for an index out of range", () => {
    expect(moveSlideshowImage([a, b], 0, 2)).toBeUndefined();
    expect(moveSlideshowImage([a, b], -1, 0)).toBeUndefined();
  });
});

describe("wrapSlideshowIndex", () => {
  it("keeps indexes in range", () => {
    expect(wrapSlideshowIndex(0, 3)).toBe(0);
    expect(wrapSlideshowIndex(2, 3)).toBe(2);
  });

  it("wraps past the last image to the first", () => {
    expect(wrapSlideshowIndex(3, 3)).toBe(0);
    expect(wrapSlideshowIndex(7, 3)).toBe(1);
  });

  it("wraps before the first image to the last", () => {
    expect(wrapSlideshowIndex(-1, 3)).toBe(2);
    expect(wrapSlideshowIndex(-4, 3)).toBe(2);
  });

  it("returns 0 for empty slideshows and invalid indexes", () => {
    expect(wrapSlideshowIndex(2, 0)).toBe(0);
    expect(wrapSlideshowIndex(Number.NaN, 3)).toBe(0);
  });
});

describe("getSlideshowIndexAfterChange", () => {
  it("keeps the index when images are added to the end", () => {
    expect(getSlideshowIndexAfterChange([a, b], [a, b, c], 1)).toBe(1);
  });

  it("follows the showing image when it is reordered", () => {
    expect(getSlideshowIndexAfterChange([a, b, c], [c, a, b], 2)).toBe(0);
  });

  it("follows the showing image when another image moves past it", () => {
    expect(getSlideshowIndexAfterChange([a, b, c], [b, a, c], 1)).toBe(0);
  });

  it("follows the showing image when an earlier image is removed", () => {
    expect(getSlideshowIndexAfterChange([a, b, c], [b, c], 2)).toBe(1);
  });

  it("shows the next image when the showing image is removed", () => {
    expect(getSlideshowIndexAfterChange([a, b, c], [a, c], 1)).toBe(1);
  });

  it("shows the new last image when the showing last image is removed", () => {
    expect(getSlideshowIndexAfterChange([a, b, c], [a, b], 2)).toBe(1);
  });

  it("returns 0 when every image is removed", () => {
    expect(getSlideshowIndexAfterChange([a], [], 0)).toBe(0);
  });

  it("keeps the same copy of a repeated image in place", () => {
    expect(getSlideshowIndexAfterChange([a, b, a], [a, b, a, c], 2)).toBe(2);
  });

  it("picks the nearest copy of a repeated image", () => {
    expect(getSlideshowIndexAfterChange([a, b, c, a], [b, c, a, a], 3)).toBe(3);
    expect(getSlideshowIndexAfterChange([b, a, c, d], [a, c, d, a], 1)).toBe(0);
  });

  it("clamps an index that was already out of range", () => {
    expect(getSlideshowIndexAfterChange([a], [a, b], 5)).toBe(1);
  });
});

describe("mergeSlideshowUploads", () => {
  it("adds the first uploads after the existing images", () => {
    expect(mergeSlideshowUploads([a, b], [], [c])).toEqual([a, b, c]);
  });

  it("replaces the uploads written last time", () => {
    expect(mergeSlideshowUploads([a, c], [c], [c, d])).toEqual([a, c, d]);
  });

  it("keeps images added by someone else while uploading", () => {
    expect(mergeSlideshowUploads([a, c, b], [c], [c, d])).toEqual([a, b, c, d]);
  });

  it("keeps an existing copy of an image that is uploaded again", () => {
    expect(mergeSlideshowUploads([a, b, a], [a], [a, c])).toEqual([a, b, a, c]);
  });
});
