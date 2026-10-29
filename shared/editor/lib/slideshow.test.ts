import type { SlideshowUploadItem } from "./slideshow";
import {
  DEFAULT_SLIDESHOW_INTERVAL,
  SLIDESHOW_INTERVALS,
  formatSlideshowInterval,
  getUploadedSlideshowImages,
  isSlideshowImageUrl,
  parseSlideshowUrls,
  toSlideshowAttrs,
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
