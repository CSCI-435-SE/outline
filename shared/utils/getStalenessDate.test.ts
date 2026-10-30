import { subDays } from "date-fns";
import { getStalenessDate } from "./getStalenessDate";
import { isStale, STALE_DOCUMENT_THRESHOLD_DAYS } from "./isStale";

describe("#getStalenessDate", () => {
  it("returns undefined when neither date is known", () => {
    expect(getStalenessDate(undefined, undefined)).toBeUndefined();
    expect(getStalenessDate(null, null)).toBeUndefined();
  });

  it("returns the edit date when the document was never reviewed", () => {
    const edited = subDays(new Date(), 10);
    expect(getStalenessDate(edited, null)).toEqual(edited);
  });

  it("returns the later of the edit and review dates", () => {
    const edited = subDays(new Date(), 200);
    const reviewed = subDays(new Date(), 5);

    expect(getStalenessDate(edited, reviewed)).toEqual(reviewed);
    expect(getStalenessDate(reviewed, edited)).toEqual(reviewed);
  });

  it("accepts ISO strings", () => {
    const reviewed = subDays(new Date(), 5);
    expect(
      getStalenessDate(
        subDays(new Date(), 200).toISOString(),
        reviewed.toISOString()
      )
    ).toEqual(reviewed);
  });

  it("clears staleness after a review", () => {
    const edited = subDays(new Date(), STALE_DOCUMENT_THRESHOLD_DAYS + 30);

    expect(isStale(getStalenessDate(edited, null))).toBe(true);
    expect(isStale(getStalenessDate(edited, new Date()))).toBe(false);
  });

  it("becomes stale again once the review is old enough", () => {
    const edited = subDays(new Date(), STALE_DOCUMENT_THRESHOLD_DAYS + 60);
    const reviewed = subDays(new Date(), STALE_DOCUMENT_THRESHOLD_DAYS + 1);

    expect(isStale(getStalenessDate(edited, reviewed))).toBe(true);
  });
});
