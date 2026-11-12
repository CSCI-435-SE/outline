import type { TFunction } from "i18next";
import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { DocumentReviewStatus } from "@shared/types";
import type Document from "~/models/Document";
import Badge from "~/components/Badge";
import Tooltip from "~/components/Tooltip";
import useStores from "~/hooks/useStores";

type Props = {
  document: Document;
};

type ReviewStatusDisplay = {
  /** The text shown in the badge. */
  label: string;
  /** The badge color, the default is a neutral outline. */
  variant?: "yellow" | "primary";
  /** Who did what to reach this status, shown on hover. */
  details?: string;
};

type ReviewPeople = {
  /** Whether the document has a reviewer, they are cleared when deleted. */
  hasReviewer: boolean;
  /** The reviewer's name, once loaded. */
  reviewerName?: string;
  /** The name of the user who requested the review, once loaded. */
  requesterName?: string;
};

/**
 * The badge text, color and hover details for a review status. Only the
 * reviewer can approve or request changes, and only an edit moves an approved
 * document back to draft, so the details name the person who acted.
 *
 * @param status The review status to show, null when there is none.
 * @param people The reviewer and requester of the document.
 * @param t The translation function.
 * @returns The badge to show, or null when no badge should be shown.
 */
export function reviewStatusDisplay(
  status: DocumentReviewStatus | null,
  people: ReviewPeople,
  t: TFunction
): ReviewStatusDisplay | null {
  const { hasReviewer, reviewerName, requesterName } = people;

  switch (status) {
    case DocumentReviewStatus.Draft:
      // "Draft" already means unpublished in Outline, so use other wording.
      return {
        label: t("Needs review"),
        details: reviewerName
          ? t("Previously approved by {{ userName }}", {
              userName: reviewerName,
            })
          : undefined,
      };
    case DocumentReviewStatus.InReview:
      return {
        label: !hasReviewer
          ? t("In review · Reviewer unavailable")
          : reviewerName
            ? t("In review · {{ reviewerName }}", { reviewerName })
            : t("In review"),
        details: requesterName
          ? t("Review requested by {{ userName }}", { userName: requesterName })
          : undefined,
      };
    case DocumentReviewStatus.ChangesRequested:
      return {
        label: t("Changes requested"),
        variant: "yellow",
        details: reviewerName
          ? t("Changes requested by {{ userName }}", { userName: reviewerName })
          : undefined,
      };
    case DocumentReviewStatus.Approved:
      return {
        label: t("Approved"),
        variant: "primary",
        details: reviewerName
          ? t("Approved by {{ userName }}", { userName: reviewerName })
          : undefined,
      };
    default:
      return null;
  }
}

/**
 * Shows where the document is in the review workflow. Renders nothing when
 * the document has no review status or the workflow is turned off.
 */
function ReviewStatusBadge({ document }: Props) {
  const { t } = useTranslation();
  const { users } = useStores();
  const status = document.visibleReviewStatus;
  const { reviewerId, reviewRequestedById } = document;

  // Reviewer and requester names are shown in the badge and tooltip, load
  // them if they are not in the store yet.
  React.useEffect(() => {
    for (const id of [reviewerId, reviewRequestedById]) {
      if (id && !users.get(id)) {
        void users.fetch(id).catch(() => undefined);
      }
    }
  }, [users, reviewerId, reviewRequestedById]);

  const reviewer = reviewerId ? users.get(reviewerId) : undefined;
  const requester = reviewRequestedById
    ? users.get(reviewRequestedById)
    : undefined;

  const display = reviewStatusDisplay(
    status,
    {
      hasReviewer: !!reviewerId,
      reviewerName: reviewer?.name,
      requesterName: requester?.name,
    },
    t
  );
  if (!display) {
    return null;
  }
  const { label, variant, details } = display;

  const badge = (
    <Badge yellow={variant === "yellow"} primary={variant === "primary"}>
      {label}
    </Badge>
  );

  return details ? (
    <Tooltip content={details} placement="bottom">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}

export default observer(ReviewStatusBadge);
