import { DocumentValidation } from "@shared/validations";

// Mirrors the near-limit calculation in DocumentTitle.tsx:
// const isNearLimit = title.length >= maxLength - 20;
function isNearLimit(length: number, maxLength: number) {
  return length >= maxLength - 20;
}

describe("DocumentTitle character counter threshold", () => {
  const maxLength = DocumentValidation.maxTitleLength;

  it("is false when well below the limit", () => {
    expect(isNearLimit(0, maxLength)).toBe(false);
    expect(isNearLimit(maxLength - 21, maxLength)).toBe(false);
  });

  it("is true at exactly 20 characters remaining", () => {
    expect(isNearLimit(maxLength - 20, maxLength)).toBe(true);
  });

  it("is true when at or over the limit", () => {
    expect(isNearLimit(maxLength, maxLength)).toBe(true);
    expect(isNearLimit(maxLength + 10, maxLength)).toBe(true);
  });
});
