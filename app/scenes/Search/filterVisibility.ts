type Props = {
    /** True when the search is scoped to a single document. */
    hasDocument: boolean;
    /** The current search query, if any. */
    query?: string;
  };
  
  /**
   * Which search filters to show. All filters are available before a search is run.
   */
  export function getFilterVisibility({ hasDocument, query }: Props) {
    return {
      document: hasDocument,
      collection: !hasDocument,
      user: !hasDocument || !!query,
      documentType: true,
      date: true,
      title: !hasDocument,
      sort: true,
    };
  }