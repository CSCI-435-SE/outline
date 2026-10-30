import { differenceInDays } from "date-fns";

/** The number of days without an edit after which a document is considered stale. */
export const STALE_DOCUMENT_THRESHOLD_DAYS = 180;

/**
 * Whether a document is stale, based on when its content was last edited.
 *
 * @param lastEditedAt When the document content was last edited.
 * @param thresholdDays Optional custom threshold in days. Defaults to STALE_DOCUMENT_THRESHOLD_DAYS.
 * @returns True if the document has not been edited within the threshold, false
 * if it has or the edit date is unknown.
 */
export function isStale(
  lastEditedAt: string | Date | null | undefined,
  thresholdDays: number = STALE_DOCUMENT_THRESHOLD_DAYS
) {
  if (!lastEditedAt) {
    return false;
  }

  return (
    differenceInDays(new Date(), new Date(lastEditedAt)) >= thresholdDays
  );
}