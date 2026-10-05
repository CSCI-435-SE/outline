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
