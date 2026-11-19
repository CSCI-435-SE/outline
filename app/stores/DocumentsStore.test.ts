/* oxlint-disable */
import { vi } from "vitest";
import stores from "~/stores";
import { client } from "~/utils/ApiClient";

describe("DocumentsStore#archive", () => {
  const archivedAt = new Date().toISOString();

  beforeEach(() => {
    vi.mocked(client.post).mockClear();
  });

  test("should send the reason and store it on the document", async () => {
    const document = stores.documents.add({
      id: "doc-with-reason",
      title: "Old guide",
    });
    vi.mocked(client.post).mockResolvedValueOnce({
      data: {
        id: document.id,
        archivedAt,
        archivedReason: "Superseded by the new guide",
      },
      policies: [],
    });

    await document.archive("Superseded by the new guide");

    expect(client.post).toHaveBeenCalledWith("/documents.archive", {
      id: document.id,
      reason: "Superseded by the new guide",
    });
    expect(document.isArchived).toBe(true);
    expect(document.archivedReason).toBe("Superseded by the new guide");
  });

  test("should not send a reason when none is given", async () => {
    const document = stores.documents.add({
      id: "doc-without-reason",
      title: "Old guide",
    });
    vi.mocked(client.post).mockResolvedValueOnce({
      data: {
        id: document.id,
        archivedAt,
        archivedReason: null,
      },
      policies: [],
    });

    await document.archive();

    expect(client.post).toHaveBeenCalledWith("/documents.archive", {
      id: document.id,
      reason: undefined,
    });
    expect(document.isArchived).toBe(true);
    expect(document.archivedReason).toBeNull();
  });
});

describe("DocumentsStore review workflow", () => {
  beforeEach(() => {
    vi.mocked(client.post).mockReset();
  });

  const build = (id: string, fields: Record<string, unknown> = {}) =>
    stores.documents.add({ id, title: "Security policy", ...fields });

  test("requestReview should send the reviewer and store the new state", async () => {
    const document = build("doc-request-review");
    vi.mocked(client.post).mockResolvedValueOnce({
      data: {
        id: document.id,
        reviewStatus: "in_review",
        reviewerId: "user-reviewer",
        reviewRequestedById: "user-author",
      },
      policies: [],
    });

    await document.requestReview("user-reviewer");

    expect(client.post).toHaveBeenCalledWith("/documents.request_review", {
      id: document.id,
      reviewerId: "user-reviewer",
    });
    expect(document.reviewStatus).toBe("in_review");
    expect(document.reviewerId).toBe("user-reviewer");
  });

  test.each([
    ["approve", "/documents.approve", "approved"],
    ["requestChanges", "/documents.request_changes", "changes_requested"],
  ] as const)(
    "%s should call %s and store the new status",
    async (method, path, status) => {
      const document = build(`doc-${method}`, {
        reviewStatus: "in_review",
        reviewerId: "user-reviewer",
      });
      vi.mocked(client.post).mockResolvedValueOnce({
        data: { id: document.id, reviewStatus: status },
        policies: [],
      });

      await document[method]();

      expect(client.post).toHaveBeenCalledWith(path, { id: document.id });
      expect(document.reviewStatus).toBe(status);
    }
  );

  test.each(["requestReview", "approve", "requestChanges"] as const)(
    "%s should leave the document unchanged when the request fails",
    async (method) => {
      const document = build(`doc-${method}-error`, {
        reviewStatus: "in_review",
        reviewerId: "user-reviewer",
      });
      vi.mocked(client.post).mockRejectedValueOnce(new Error("Forbidden"));

      await expect(
        method === "requestReview"
          ? document.requestReview("user-other")
          : document[method]()
      ).rejects.toThrow("Forbidden");

      expect(document.reviewStatus).toBe("in_review");
      expect(document.reviewerId).toBe("user-reviewer");
    }
  );
});
