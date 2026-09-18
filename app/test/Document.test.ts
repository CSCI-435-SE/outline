import Document from "./Document";
import stores from "~/stores";

describe("Document model", () => {
  const documents = stores.documents;

  describe("isBadgedNew", () => {
    test("should show unread indicator for a recently created document that has never been viewed", () => {
      const document = new Document(
        {
          id: "doc-1",
          title: "Test",
          createdAt: new Date().toISOString(),
          lastViewedAt: undefined,
        },
        documents
      );
      expect(document.isBadgedNew).toBe(true);
    });

    test("should not show unread indicator once the document has been viewed", () => {
      const document = new Document(
        {
          id: "doc-2",
          title: "Test",
          createdAt: new Date().toISOString(),
          lastViewedAt: new Date().toISOString(),
        },
        documents
      );
      expect(document.isBadgedNew).toBe(false);
    });

    test("should not show unread indicator once the document is older than 14 days", () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const document = new Document(
        {
          id: "doc-3",
          title: "Test",
          createdAt: fifteenDaysAgo.toISOString(),
          lastViewedAt: undefined,
        },
        documents
      );
      expect(document.isBadgedNew).toBe(false);
    });

    test("should still show unread indicator just inside the 14 day window", () => {
      const thirteenDaysAgo = new Date();
      thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);

      const document = new Document(
        {
          id: "doc-4",
          title: "Test",
          createdAt: thirteenDaysAgo.toISOString(),
          lastViewedAt: undefined,
        },
        documents
      );
      expect(document.isBadgedNew).toBe(true);
    });
  });
});
