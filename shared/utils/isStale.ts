import { differenceInDays } from "date-fns";

/** The number of days without an edit after which a document is considered stale. */
export const STALE_DOCUMENT_THRESHOLD_DAYS = 180;

/**
 * Whether a document is stale, based on when its content was last edited.
 *
 * @param lastEditedAt When the document content was last edited.
 * @returns True if the document has not been edited within the threshold, false
 * if it has or the edit date is unknown.
 */
export function isStale(lastEditedAt: string | Date | null | undefined) {
  if (!lastEditedAt) {
    return false;
  }

  return (
    differenceInDays(new Date(), new Date(lastEditedAt)) >=
    STALE_DOCUMENT_THRESHOLD_DAYS
  );
}
