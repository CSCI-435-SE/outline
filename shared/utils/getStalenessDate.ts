/**
 * Returns the date a document's staleness is measured from: the later of when
 * it was last edited and when it was last marked as reviewed. Reviewing a
 * document confirms it is still accurate, so it resets the stale clock just
 * like an edit does.
 *
 * @param lastEditedAt When the document content was last edited.
 * @param reviewedAt When the document was last marked as reviewed.
 * @returns The later of the two dates, or undefined if neither is known.
 */
export function getStalenessDate(
  lastEditedAt: string | Date | null | undefined,
  reviewedAt: string | Date | null | undefined
): Date | undefined {
  const dates = [lastEditedAt, reviewedAt]
    .filter((date): date is string | Date => !!date)
    .map((date) => new Date(date))
    .filter((date) => !isNaN(date.getTime()));

  if (!dates.length) {
    return undefined;
  }

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}
