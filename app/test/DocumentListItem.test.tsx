import type { TFunction } from "i18next";
import stores from "~/stores";

// react-dnd's DndProvider pulls in an ESM build that can't resolve React
// 17's jsx-runtime under Vitest. It isn't exercised by the pure path-segment
// logic under test, so it's mocked out the same way Sidebar.test.tsx works
// around the equivalent Radix UI issue.
vi.mock("~/components/Sidebar/hooks/useDragAndDrop", () => ({
  useDragDocument: () => [{ isDragging: false }, null],
}));

const { archivedDocumentPathSegments } =
  await import("~/components/DocumentListItem");

const t = ((key: string) => key) as unknown as TFunction;

describe("archivedDocumentPathSegments", () => {
  afterEach(() => {
    stores.documents.clear();
    stores.collections.clear();
  });

  test("should return only the collection name for a top-level document", () => {
    stores.collections.add({ id: "collection-1", name: "Engineering" });
    const document = stores.documents.add({
      id: "doc-1",
      title: "Roadmap",
      collectionId: "collection-1",
    });

    expect(archivedDocumentPathSegments(document, t)).toEqual(["Engineering"]);
  });

  test("should include each ancestor document, root to immediate parent", () => {
    stores.collections.add({ id: "collection-2", name: "Engineering" });
    const document = stores.documents.add({
      id: "doc-2",
      title: "Auth",
      collectionId: "collection-2",
      ancestorDocuments: [
        { id: "ancestor-1", title: "Engineering handbook" },
        { id: "ancestor-2", title: "Backend" },
      ],
    });

    expect(archivedDocumentPathSegments(document, t)).toEqual([
      "Engineering",
      "Engineering handbook",
      "Backend",
    ]);
  });

  test("should fall back to a Deleted Collection label", () => {
    const document = stores.documents.add({
      id: "doc-3",
      title: "Auth",
      isCollectionDeleted: true,
      ancestorDocuments: [{ id: "ancestor-1", title: "Backend" }],
    });

    expect(archivedDocumentPathSegments(document, t)).toEqual([
      "Deleted Collection",
      "Backend",
    ]);
  });

  test("should fall back to Untitled for an ancestor with no title", () => {
    stores.collections.add({ id: "collection-4", name: "Engineering" });
    const document = stores.documents.add({
      id: "doc-4",
      title: "Auth",
      collectionId: "collection-4",
      ancestorDocuments: [{ id: "ancestor-1", title: "" }],
    });

    expect(archivedDocumentPathSegments(document, t)).toEqual([
      "Engineering",
      "Untitled",
    ]);
  });

  test("should return an empty array when there is no collection or ancestors", () => {
    const document = stores.documents.add({
      id: "doc-5",
      title: "Auth",
    });

    expect(archivedDocumentPathSegments(document, t)).toEqual([]);
  });
});
