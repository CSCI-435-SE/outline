import type { GalleryTemplate } from "./templateGallery";
import {
  filterGalleryTemplates,
  TemplateSourceFilter,
} from "./templateGallery";

const build = (overrides: Partial<GalleryTemplate>): GalleryTemplate => ({
  title: "Template",
  description: null,
  isBuiltIn: false,
  isActive: true,
  publishedAt: "2026-10-08T00:00:00.000Z",
  collectionId: null,
  ...overrides,
});

describe("filterGalleryTemplates", () => {
  it("should exclude deleted and unpublished templates", () => {
    const visible = build({ title: "Visible" });
    const result = filterGalleryTemplates([
      visible,
      build({ title: "Deleted", isActive: false }),
      build({ title: "Draft", publishedAt: null }),
    ]);
    expect(result).toEqual([visible]);
  });

  it("should list built-in templates first, then alphabetically", () => {
    const result = filterGalleryTemplates([
      build({ title: "Zebra" }),
      build({ title: "Retrospective", isBuiltIn: true }),
      build({ title: "Apple" }),
      build({ title: "Bug report", isBuiltIn: true }),
    ]);
    expect(result.map((t) => t.title)).toEqual([
      "Bug report",
      "Retrospective",
      "Apple",
      "Zebra",
    ]);
  });

  it("should filter by source", () => {
    const builtIn = build({ title: "Meeting notes", isBuiltIn: true });
    const member = build({ title: "Onboarding" });

    expect(
      filterGalleryTemplates([builtIn, member], {
        source: TemplateSourceFilter.BuiltIn,
      })
    ).toEqual([builtIn]);
    expect(
      filterGalleryTemplates([builtIn, member], {
        source: TemplateSourceFilter.Member,
      })
    ).toEqual([member]);
  });

  it("should search title and description, ignoring case and accents", () => {
    const byTitle = build({ title: "Résumé review" });
    const byDescription = build({
      title: "Weekly sync",
      description: "Capture DECISIONS and action items",
    });
    const other = build({ title: "Other" });

    expect(
      filterGalleryTemplates([byTitle, byDescription, other], {
        query: "resume",
      })
    ).toEqual([byTitle]);
    expect(
      filterGalleryTemplates([byTitle, byDescription, other], {
        query: "  decisions ",
      })
    ).toEqual([byDescription]);
  });

  it("should only include workspace templates and those in the target collection", () => {
    const workspace = build({ title: "Workspace" });
    const inCollection = build({ title: "Mine", collectionId: "a" });
    const elsewhere = build({ title: "Elsewhere", collectionId: "b" });

    expect(
      filterGalleryTemplates([workspace, inCollection, elsewhere], {
        collectionId: "a",
      }).map((t) => t.title)
    ).toEqual(["Mine", "Workspace"]);
    expect(
      filterGalleryTemplates([workspace, inCollection, elsewhere])
    ).toHaveLength(3);
  });
});
