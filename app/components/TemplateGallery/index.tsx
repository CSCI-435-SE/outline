import { observer } from "mobx-react";
import { DocumentIcon } from "outline-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import Icon from "@shared/components/Icon";
import { s } from "@shared/styles";
import { TextHelper } from "@shared/utils/TextHelper";
import Badge from "~/components/Badge";
import Button from "~/components/Button";
import DelayedMount from "~/components/DelayedMount";
import Empty from "~/components/Empty";
import FilterOptions from "~/components/FilterOptions";
import Flex from "~/components/Flex";
import InputSearch from "~/components/InputSearch";
import PlaceholderList from "~/components/List/Placeholder";
import Text from "~/components/Text";
import type Template from "~/models/Template";
import useCurrentUser from "~/hooks/useCurrentUser";
import useRequest from "~/hooks/useRequest";
import useStores from "~/hooks/useStores";
import history from "~/utils/history";
import { newDocumentPath } from "~/utils/routeHelpers";
import {
  filterGalleryTemplates,
  TemplateSourceFilter,
} from "~/utils/templateGallery";

interface Props {
  /**
   * The collection new documents should be created in. When omitted documents
   * are created in the template's collection, or as a draft for workspace
   * templates.
   */
  collectionId?: string | null;
}

/**
 * A searchable gallery of the templates available to the current user.
 * Selecting a template creates a new document from it; closing the gallery
 * creates nothing.
 */
export const TemplateGallery = observer(function TemplateGallery({
  collectionId,
}: Props) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { templates, collections, policies, dialogs } = useStores();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(TemplateSourceFilter.All);
  const { request, loading } = useRequest(templates.fetchAll);

  useEffect(() => {
    void request();
  }, [request]);

  const sourceOptions = useMemo(
    () => [
      { key: TemplateSourceFilter.All, label: t("All templates") },
      { key: TemplateSourceFilter.BuiltIn, label: t("Built-in") },
      { key: TemplateSourceFilter.Member, label: t("Created by members") },
    ],
    [t]
  );

  const items = filterGalleryTemplates(templates.all, {
    query,
    source,
    collectionId,
  }).filter((template) => {
    // Without a target collection, collection templates create documents in
    // their own collection so the user must be able to create documents there.
    const targetCollectionId = collectionId ?? template.collectionId;
    return (
      !targetCollectionId ||
      !!policies.abilities(targetCollectionId).createDocument
    );
  });

  const handleChangeQuery = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    []
  );

  const handleSelectSource = useCallback((key: string | null | undefined) => {
    const match = Object.values(TemplateSourceFilter).find((v) => v === key);
    setSource(match ?? TemplateSourceFilter.All);
  }, []);

  const handleSelectTemplate = useCallback(
    (template: Template) => {
      dialogs.closeAllModals();
      history.push(
        newDocumentPath(collectionId ?? template.collectionId, {
          templateId: template.id,
        })
      );
    },
    [collectionId, dialogs]
  );

  const handleCancel = useCallback(() => {
    dialogs.closeAllModals();
  }, [dialogs]);

  const isEmpty = !items.length;

  return (
    <Flex column gap={12}>
      <Flex gap={8} align="center">
        <InputSearch
          value={query}
          onChange={handleChangeQuery}
          placeholder={`${t("Search templates")}…`}
          label={t("Search templates")}
          labelHidden
          margin={0}
          autoFocus
          flex
        />
        <FilterOptions
          options={sourceOptions}
          selectedKeys={[source]}
          onSelect={handleSelectSource}
          showIcons={false}
        />
      </Flex>

      {loading && isEmpty ? (
        <DelayedMount>
          <PlaceholderList count={4} />
        </DelayedMount>
      ) : isEmpty ? (
        <Empty role="status">
          {query || source !== TemplateSourceFilter.All
            ? t("No templates match your search")
            : t("No templates are available yet")}
        </Empty>
      ) : (
        <Grid role="list" aria-label={t("Templates")}>
          {items.map((template) => {
            const collection = template.collectionId
              ? collections.get(template.collectionId)
              : undefined;
            const title = TextHelper.replaceTemplateVariables(
              template.titleWithDefault,
              user
            );

            return (
              <li key={template.id}>
                <Card
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  aria-label={t("Create a document from {{ title }}", {
                    title,
                  })}
                >
                  <Flex gap={8} align="center">
                    {template.icon ? (
                      <Icon
                        value={template.icon}
                        initial={template.initial}
                        color={template.color ?? undefined}
                      />
                    ) : (
                      <DocumentIcon />
                    )}
                    <CardTitle>{title}</CardTitle>
                  </Flex>
                  <Description type="secondary" size="small">
                    {template.description || t("No description")}
                  </Description>
                  <div>
                    {template.isBuiltIn ? (
                      <Badge primary>{t("Built-in")}</Badge>
                    ) : (
                      <Badge>
                        {collection ? collection.name : t("Workspace")}
                      </Badge>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </Grid>
      )}

      <Flex justify="flex-end">
        <Button onClick={handleCancel} neutral>
          {t("Cancel")}
        </Button>
      </Flex>
    </Flex>
  );
});

const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 50vh;
  overflow-y: auto;
`;

const Card = styled.button`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 12px;
  text-align: start;
  cursor: var(--pointer);
  color: ${s("text")};
  background: ${s("background")};
  border: 1px solid ${s("inputBorder")};
  border-radius: 8px;
  transition: border-color 100ms ease-in-out;

  &:hover,
  &:focus-visible {
    border-color: ${s("accent")};
    outline: none;
  }
`;

const CardTitle = styled.span`
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Description = styled(Text)`
  flex: 1;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;
