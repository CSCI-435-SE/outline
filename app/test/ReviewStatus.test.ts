import type { TFunction } from "i18next";
import { DocumentReviewStatus } from "@shared/types";
import { reviewStatusDisplay } from "~/scenes/Document/components/ReviewStatusBadge";
import stores from "~/stores";

const t = ((key: string, options?: Record<string, string>) =>
  options
    ? key.replace(/\{\{ (\w+) \}\}/g, (_, name) => options[name])
    : key) as unknown as TFunction;

describe("reviewStatusDisplay", () => {
  const people = {
    hasReviewer: true,
    reviewerName: "Sam",
    requesterName: "Alex",
  };

  test("should show nothing when there is no review status", () => {
    expect(reviewStatusDisplay(null, people, t)).toBeNull();
  });

  test("should not use the word Draft for the draft status", () => {
    expect(reviewStatusDisplay(DocumentReviewStatus.Draft, people, t)).toEqual({
      label: "Needs review",
      details: "Previously approved by Sam",
    });
  });

  test("should name the reviewer and who asked for the review", () => {
    expect(
      reviewStatusDisplay(DocumentReviewStatus.InReview, people, t)
    ).toEqual({
      label: "In review · Sam",
      details: "Review requested by Alex",
    });
  });

  test("should credit the reviewer, not the requester, with their decision", () => {
    expect(
      reviewStatusDisplay(DocumentReviewStatus.ChangesRequested, people, t)
    ).toEqual({
      label: "Changes requested",
      variant: "yellow",
      details: "Changes requested by Sam",
    });
    expect(
      reviewStatusDisplay(DocumentReviewStatus.Approved, people, t)
    ).toEqual({
      label: "Approved",
      variant: "primary",
      details: "Approved by Sam",
    });
  });

  test("should leave out names that have not loaded yet", () => {
    expect(
      reviewStatusDisplay(
        DocumentReviewStatus.InReview,
        { hasReviewer: true },
        t
      )
    ).toEqual({ label: "In review", details: undefined });
    expect(
      reviewStatusDisplay(
        DocumentReviewStatus.ChangesRequested,
        { hasReviewer: true },
        t
      )?.details
    ).toBeUndefined();
  });

  test("should say the reviewer is unavailable when they were removed", () => {
    expect(
      reviewStatusDisplay(
        DocumentReviewStatus.InReview,
        { hasReviewer: false, requesterName: "Alex" },
        t
      )
    ).toEqual({
      label: "In review · Reviewer unavailable",
      details: "Review requested by Alex",
    });
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
