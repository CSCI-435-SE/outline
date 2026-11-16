import Storage from "@shared/utils/Storage";
import {
  addDismissedFingerprints,
  findUndismissedCredentials,
  fingerprintCredential,
  getDismissedFingerprints,
} from "./useCredentialScan";

const awsKey1 = `AKIA${"A".repeat(16)}`;
const awsKey2 = `AKIA${"B".repeat(16)}`;
const ghToken = `ghp_${"a1".repeat(18)}`;

describe("fingerprintCredential", () => {
  it("is stable for the same value", async () => {
    expect(await fingerprintCredential(awsKey1)).toEqual(
      await fingerprintCredential(awsKey1)
    );
  });

  it("differs for different values", async () => {
    expect(await fingerprintCredential(awsKey1)).not.toEqual(
      await fingerprintCredential(awsKey2)
    );
  });

  it("does not contain the credential itself", async () => {
    const fp = await fingerprintCredential(awsKey1);
    expect(fp).not.toContain(awsKey1);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("dismissed fingerprint storage", () => {
  const documentId = "doc-1";

  beforeEach(() => {
    Storage.remove(`credential-scan-dismissed:${documentId}`);
    Storage.remove("credential-scan-dismissed:doc-2");
  });

  it("returns an empty set when nothing is stored", () => {
    expect(getDismissedFingerprints(documentId).size).toBe(0);
  });

  it("round trips and merges fingerprints", () => {
    addDismissedFingerprints(documentId, ["a", "b"]);
    addDismissedFingerprints(documentId, ["b", "c"]);
    expect([...getDismissedFingerprints(documentId)].sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps dismissals separate per document", () => {
    addDismissedFingerprints(documentId, ["a"]);
    expect(getDismissedFingerprints("doc-2").size).toBe(0);
  });

  it("ignores malformed stored values", () => {
    Storage.set(`credential-scan-dismissed:${documentId}`, { not: "array" });
    expect(getDismissedFingerprints(documentId).size).toBe(0);
  });

  it("caps the number of stored fingerprints, keeping the newest", () => {
    addDismissedFingerprints(
      documentId,
      Array.from({ length: 250 }, (_, i) => `fp-${i}`)
    );
    const stored = getDismissedFingerprints(documentId);
    expect(stored.size).toBe(200);
    expect(stored.has("fp-249")).toBe(true);
    expect(stored.has("fp-0")).toBe(false);
  });
});

describe("findUndismissedCredentials", () => {
  it("returns nothing for clean text", async () => {
    const found = await findUndismissedCredentials("hello world", new Set());
    expect(found.size).toBe(0);
  });

  it("reports each distinct credential with its type", async () => {
    const found = await findUndismissedCredentials(
      `${awsKey1}\n${ghToken}`,
      new Set()
    );
    expect([...found.values()].sort()).toEqual([
      "AWS Access Key ID",
      "GitHub Token",
    ]);
  });

  it("reports the same credential once even if repeated", async () => {
    const found = await findUndismissedCredentials(
      `${awsKey1} and again ${awsKey1}`,
      new Set()
    );
    expect(found.size).toBe(1);
  });

  it("skips dismissed credentials but still reports new ones of the same type", async () => {
    const dismissed = new Set([await fingerprintCredential(awsKey1)]);
    const found = await findUndismissedCredentials(
      `${awsKey1}\n${awsKey2}`,
      dismissed
    );
    expect([...found.keys()]).toEqual([await fingerprintCredential(awsKey2)]);
    expect([...found.values()]).toEqual(["AWS Access Key ID"]);
  });
});
