/** Which kind of templates to show in the template gallery. */
export enum TemplateSourceFilter {
  All = "all",
  BuiltIn = "builtIn",
  Member = "member",
}

/** The subset of template fields used to filter the gallery. */
export interface GalleryTemplate {
  title: string;
  description?: string | null;
  isBuiltIn: boolean;
  isActive: boolean;
  publishedAt: string | null;
  collectionId?: string | null;
}

interface FilterOptions {
  /** Free-text search matched against the title and description. */
  query?: string;
  /** Restrict to built-in or member-created templates. */
  source?: TemplateSourceFilter;
  /**
   * When provided only workspace templates and templates belonging to this
   * collection are included.
   */
  collectionId?: string | null;
}

/**
 * Filters and orders templates for display in the template gallery. Deleted
 * and unpublished templates are always excluded. Built-in templates are listed
 * before member-created ones, each group sorted alphabetically.
 *
 * @param templates the templates to filter.
 * @param options the filter options.
 * @returns the filtered and ordered templates.
 */
export function filterGalleryTemplates<T extends GalleryTemplate>(
  templates: T[],
  {
    query = "",
    source = TemplateSourceFilter.All,
    collectionId,
  }: FilterOptions = {}
): T[] {
  const normalizedQuery = normalize(query.trim());

  return templates
    .filter((template) => template.isActive && !!template.publishedAt)
    .filter(
      (template) =>
        !collectionId ||
        !template.collectionId ||
        template.collectionId === collectionId
    )
    .filter((template) => {
      if (source === TemplateSourceFilter.BuiltIn) {
        return template.isBuiltIn;
      }
      if (source === TemplateSourceFilter.Member) {
        return !template.isBuiltIn;
      }
      return true;
    })
    .filter(
      (template) =>
        !normalizedQuery ||
        normalize(template.title).includes(normalizedQuery) ||
        normalize(template.description ?? "").includes(normalizedQuery)
    )
    .sort((a, b) => {
      if (a.isBuiltIn !== b.isBuiltIn) {
        return a.isBuiltIn ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
