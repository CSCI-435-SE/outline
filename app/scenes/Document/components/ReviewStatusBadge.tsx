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
};

/**
 * The badge text and color for a review status.
 *
 * @param status The review status to show, null when there is none.
 * @param reviewer Whether the document has a reviewer, and their name if it
 * has been loaded.
 * @param t The translation function.
 * @returns The badge to show, or null when no badge should be shown.
 */
export function reviewStatusDisplay(
  status: DocumentReviewStatus | null,
  reviewer: { hasReviewer: boolean; reviewerName?: string },
  t: TFunction
): ReviewStatusDisplay | null {
  switch (status) {
    case DocumentReviewStatus.Draft:
      // "Draft" already means unpublished in Outline, so use other wording.
      return { label: t("Needs review") };
    case DocumentReviewStatus.InReview:
      // The reviewer is cleared when their account is deleted.
      if (!reviewer.hasReviewer) {
        return { label: t("In review · Reviewer unavailable") };
      }
      return {
        label: reviewer.reviewerName
          ? t("In review · {{ reviewerName }}", {
              reviewerName: reviewer.reviewerName,
            })
          : t("In review"),
      };
    case DocumentReviewStatus.ChangesRequested:
      return { label: t("Changes requested"), variant: "yellow" };
    case DocumentReviewStatus.Approved:
      return { label: t("Approved"), variant: "primary" };
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
    { hasReviewer: !!reviewerId, reviewerName: reviewer?.name },
    t
  );
  if (!display) {
    return null;
  }
  const { label, variant } = display;

  const details = [
    requester
      ? t("Requested by {{ userName }}", { userName: requester.name })
      : undefined,
    reviewer
      ? t("Reviewer: {{ userName }}", { userName: reviewer.name })
      : undefined,
  ].filter(Boolean);

  const badge = (
    <Badge yellow={variant === "yellow"} primary={variant === "primary"}>
      {label}
    </Badge>
  );

  return details.length ? (
    <Tooltip content={details.join(" · ")} placement="bottom">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}

export default observer(ReviewStatusBadge);
