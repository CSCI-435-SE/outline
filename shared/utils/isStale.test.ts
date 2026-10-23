import { subDays } from "date-fns";
import { isStale, STALE_DOCUMENT_THRESHOLD_DAYS } from "./isStale";

describe("#isStale", () => {
  it("should return false for a missing date", () => {
    expect(isStale(undefined)).toBe(false);
    expect(isStale(null)).toBe(false);
  });

  it("should return false just before the threshold", () => {
    const date = subDays(new Date(), STALE_DOCUMENT_THRESHOLD_DAYS - 1);
    expect(isStale(date)).toBe(false);
  });

  it("should return true at the threshold", () => {
    const date = subDays(new Date(), STALE_DOCUMENT_THRESHOLD_DAYS);
    expect(isStale(date)).toBe(true);
  });

  it("should return true after the threshold", () => {
    const date = subDays(new Date(), STALE_DOCUMENT_THRESHOLD_DAYS + 1);
    expect(isStale(date)).toBe(true);
  });

  it("should accept ISO strings", () => {
    const date = subDays(new Date(), STALE_DOCUMENT_THRESHOLD_DAYS + 1);
    expect(isStale(date.toISOString())).toBe(true);
    expect(isStale(new Date().toISOString())).toBe(false);
  });
});
