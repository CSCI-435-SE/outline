import type { TFunction } from "i18next";
import { DocumentReviewStatus } from "@shared/types";
import { reviewStatusDisplay } from "~/scenes/Document/components/ReviewStatusBadge";
import stores from "~/stores";

const t = ((key: string, options?: Record<string, string>) =>
  options
    ? key.replace(/\{\{ (\w+) \}\}/g, (_, name) => options[name])
    : key) as unknown as TFunction;

describe("reviewStatusDisplay", () => {
  const withReviewer = { hasReviewer: true, reviewerName: "Sam" };

  test("should show nothing when there is no review status", () => {
    expect(reviewStatusDisplay(null, withReviewer, t)).toBeNull();
  });

  test("should not use the word Draft for the draft status", () => {
    expect(
      reviewStatusDisplay(DocumentReviewStatus.Draft, withReviewer, t)
    ).toEqual({ label: "Needs review" });
  });

  test("should name the reviewer when the document is in review", () => {
    expect(
      reviewStatusDisplay(DocumentReviewStatus.InReview, withReviewer, t)
    ).toEqual({ label: "In review · Sam" });
  });

  test("should not name the reviewer before their details have loaded", () => {
    expect(
      reviewStatusDisplay(
        DocumentReviewStatus.InReview,
        { hasReviewer: true },
        t
      )
    ).toEqual({ label: "In review" });
  });

  test("should say the reviewer is unavailable when they were removed", () => {
    expect(
      reviewStatusDisplay(
        DocumentReviewStatus.InReview,
        { hasReviewer: false },
        t
      )
    ).toEqual({ label: "In review · Reviewer unavailable" });
  });

  test("should highlight changes requested and approved", () => {
    expect(
      reviewStatusDisplay(
        DocumentReviewStatus.ChangesRequested,
        withReviewer,
        t
      )
    ).toEqual({ label: "Changes requested", variant: "yellow" });
    expect(
      reviewStatusDisplay(DocumentReviewStatus.Approved, withReviewer, t)
    ).toEqual({ label: "Approved", variant: "primary" });
  });
});

describe("UsersStore#reviewCandidates", () => {
  beforeAll(() => {
    // the shared test store starts with a placeholder user that has no name
    stores.users.clear();
    const lastActiveAt = new Date().toISOString();
    stores.users.add({ id: "user-author", name: "Alex Author", lastActiveAt });
    stores.users.add({ id: "user-sam", name: "Sam Reviewer", lastActiveAt });
    stores.users.add({
      id: "user-suspended",
      name: "Suspended Sue",
      lastActiveAt,
      isSuspended: true,
    });
    // users who have never signed in are still invited
    stores.users.add({ id: "user-invited", name: "Invited Ivy" });
  });

  afterAll(() => {
    stores.users.clear();
  });

  const ids = (requesterId: string, query?: string) =>
    stores.users.reviewCandidates(requesterId, query).map((user) => user.id);

  test("should leave out the requester", () => {
    expect(ids("user-author")).not.toContain("user-author");
    expect(ids("user-author")).toContain("user-sam");
  });

  test("should leave out suspended and invited users", () => {
    expect(ids("user-author")).not.toContain("user-suspended");
    expect(ids("user-author")).not.toContain("user-invited");
  });

  test("should filter by name", () => {
    expect(ids("user-author", "sam")).toEqual(["user-sam"]);
    expect(ids("user-author", "nobody")).toEqual([]);
  });
});
