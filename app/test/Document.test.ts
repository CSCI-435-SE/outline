import Document from "~/models/Document";
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

  describe("isStale", () => {
    const daysAgo = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toISOString();
    };

    test("should be stale when a published document has not been edited in 90 days", () => {
      const document = new Document(
        {
          id: "stale-1",
          title: "Test",
          publishedAt: daysAgo(200),
          lastEditedAt: daysAgo(91),
        },
        documents
      );
      expect(document.isStale).toBe(true);
    });

    test("should not be stale when recently edited", () => {
      const document = new Document(
        {
          id: "stale-2",
          title: "Test",
          publishedAt: daysAgo(200),
          lastEditedAt: daysAgo(1),
        },
        documents
      );
      expect(document.isStale).toBe(false);
    });

    test("should not be stale for drafts", () => {
      const document = new Document(
        {
          id: "stale-3",
          title: "Test",
          publishedAt: undefined,
          lastEditedAt: daysAgo(91),
        },
        documents
      );
      expect(document.isStale).toBe(false);
    });

    test("should not be stale for archived documents", () => {
      const document = new Document(
        {
          id: "stale-4",
          title: "Test",
          publishedAt: daysAgo(200),
          archivedAt: daysAgo(10),
          lastEditedAt: daysAgo(91),
        },
        documents
      );
      expect(document.isStale).toBe(false);
    });

    test("should not be stale when the edit date is unknown", () => {
      const document = new Document(
        {
          id: "stale-5",
          title: "Test",
          publishedAt: daysAgo(200),
          lastEditedAt: undefined,
        },
        documents
      );
      expect(document.isStale).toBe(false);
    });
  });
});
