import Document from "~/models/Document";
import { DocumentReviewStatus, TeamPreference } from "@shared/types";
import { STALE_DOCUMENT_THRESHOLD_DAYS } from "@shared/utils/isStale";
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

    test("should be stale when a published document has not been edited within the threshold", () => {
      const document = new Document(
        {
          id: "stale-1",
          title: "Test",
          publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
          lastEditedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 1),
        },
        documents
      );
      expect(document.isStale).toBe(true);
    });

    describe("when the team has not saved a staleness threshold", () => {
      beforeAll(() => {
        stores.auth.add({ id: "team-no-threshold", preferences: {} });
        stores.auth.currentTeamId = "team-no-threshold";
      });

      afterAll(() => {
        stores.auth.currentTeamId = undefined;
      });

      test("should use the default threshold", () => {
        expect(
          stores.auth.team?.getPreference(TeamPreference.StalenessThreshold)
        ).toBe(STALE_DOCUMENT_THRESHOLD_DAYS);
      });

      test("should not be stale when recently edited", () => {
        const document = new Document(
          {
            id: "stale-no-threshold",
            title: "Test",
            publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
            lastEditedAt: daysAgo(1),
          },
          documents
        );
        expect(document.isStale).toBe(false);
      });
    });

    test("should not be stale when recently edited", () => {
      const document = new Document(
        {
          id: "stale-2",
          title: "Test",
          publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
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
          lastEditedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 1),
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
          publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
          archivedAt: daysAgo(10),
          lastEditedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 1),
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
          publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
          lastEditedAt: undefined,
        },
        documents
      );
      expect(document.isStale).toBe(false);
    });

    test("should not be stale when reviewed within the threshold", () => {
      const document = new Document(
        {
          id: "stale-6",
          title: "Test",
          publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
          lastEditedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 50),
          reviewedAt: daysAgo(1),
        },
        documents
      );
      expect(document.isStale).toBe(false);
    });

    test("should be stale again when the review is older than the threshold", () => {
      const document = new Document(
        {
          id: "stale-7",
          title: "Test",
          publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
          lastEditedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 50),
          reviewedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 1),
        },
        documents
      );
      expect(document.isStale).toBe(true);
    });

    test("should stop being stale after marking as reviewed", () => {
      const document = new Document(
        {
          id: "stale-8",
          title: "Test",
          publishedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 100),
          lastEditedAt: daysAgo(STALE_DOCUMENT_THRESHOLD_DAYS + 1),
        },
        documents
      );
      expect(document.isStale).toBe(true);

      document.updateData({ reviewedAt: new Date().toISOString() });
      expect(document.isStale).toBe(false);
    });
  });

  describe("isReviewedSinceEdit", () => {
    test("should be false when the document was never reviewed", () => {
      const document = new Document(
        { id: "reviewed-1", title: "Test", lastEditedAt: "2026-01-01" },
        documents
      );
      expect(document.isReviewedSinceEdit).toBe(false);
    });

    test("should be true when the review is newer than the last edit", () => {
      const document = new Document(
        {
          id: "reviewed-2",
          title: "Test",
          lastEditedAt: "2026-01-01T00:00:00.000Z",
          reviewedAt: "2026-02-01T00:00:00.000Z",
        },
        documents
      );
      expect(document.isReviewedSinceEdit).toBe(true);
    });

    test("should be false when the document was edited after the review", () => {
      const document = new Document(
        {
          id: "reviewed-3",
          title: "Test",
          lastEditedAt: "2026-03-01T00:00:00.000Z",
          reviewedAt: "2026-02-01T00:00:00.000Z",
        },
        documents
      );
      expect(document.isReviewedSinceEdit).toBe(false);
    });
  });
  describe("visibleReviewStatus", () => {
    const build = (reviewStatus?: DocumentReviewStatus | null) =>
      new Document(
        { id: `doc-${reviewStatus}`, title: "Test", reviewStatus },
        documents
      );

    const setReviewWorkflow = (enabled: boolean) => {
      stores.auth.add({
        id: "team-review",
        preferences: { reviewWorkflow: enabled },
      });
      stores.auth.currentTeamId = "team-review";
    };

    beforeEach(() => setReviewWorkflow(true));

    afterAll(() => {
      stores.auth.currentTeamId = undefined;
    });

    test.each([
      DocumentReviewStatus.Draft,
      DocumentReviewStatus.InReview,
      DocumentReviewStatus.ChangesRequested,
      DocumentReviewStatus.Approved,
    ])("should show the %s status when the workflow is on", (status) => {
      expect(build(status).visibleReviewStatus).toBe(status);
    });

    test.each([
      DocumentReviewStatus.ChangesRequested,
      DocumentReviewStatus.Draft,
    ])(
      "should offer to request review again from the reviewer of a %s document",
      (status) => {
        const document = new Document(
          {
            id: `doc-again-${status}`,
            title: "Test",
            reviewStatus: status,
            reviewerId: "user-reviewer",
          },
          documents
        );
        expect(document.canRequestReviewAgain).toBe(true);
      }
    );

    test("should not offer to request review again without a reviewer", () => {
      const document = new Document(
        {
          id: "doc-again-no-reviewer",
          title: "Test",
          reviewStatus: DocumentReviewStatus.ChangesRequested,
          reviewerId: null,
        },
        documents
      );
      expect(document.canRequestReviewAgain).toBe(false);
    });

    test.each([DocumentReviewStatus.InReview, DocumentReviewStatus.Approved])(
      "should not offer to request review again for a %s document",
      (status) => {
        const document = new Document(
          {
            id: `doc-again-${status}`,
            title: "Test",
            reviewStatus: status,
            reviewerId: "user-reviewer",
          },
          documents
        );
        expect(document.canRequestReviewAgain).toBe(false);
      }
    );

    test("should hide the status when the workflow is off", () => {
      setReviewWorkflow(false);
      expect(build(DocumentReviewStatus.Approved).visibleReviewStatus).toBe(
        null
      );
    });

    test.each([null, undefined])("should be null for a %s status", (status) => {
      expect(build(status).visibleReviewStatus).toBe(null);
    });
  });
});
