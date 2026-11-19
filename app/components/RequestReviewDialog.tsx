import { debounce } from "es-toolkit/compat";
import { observer } from "mobx-react";
import { CheckmarkIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import type Document from "~/models/Document";
import type User from "~/models/User";
import { Avatar, AvatarSize } from "~/components/Avatar";
import ButtonLink from "~/components/ButtonLink";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Empty from "~/components/Empty";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import ListItem from "~/components/List/Item";
import Text from "~/components/Text";
import useCurrentUser from "~/hooks/useCurrentUser";
import useStores from "~/hooks/useStores";
import { BadRequestError } from "~/utils/errors";

/** The server's message when the reviewer cannot read the document. */
const NO_ACCESS_MESSAGE = "Share this document with the reviewer first";

type Props = {
  /** The document to request a review of. */
  document: Document;
  /** Opens the share dialog, offered when the reviewer has no access. */
  onShare: () => void;
  /** Called once the review has been requested. */
  onRequested: () => void;
};

function RequestReviewDialog({ document, onShare, onRequested }: Props) {
  const { t } = useTranslation();
  const { users } = useStores();
  const user = useCurrentUser();
  const [query, setQuery] = React.useState("");
  // Start from the current reviewer, unless that is the person asking.
  const [selectedId, setSelectedId] = React.useState<string | undefined>(
    document.reviewerId && document.reviewerId !== user.id
      ? document.reviewerId
      : undefined
  );
  const [error, setError] = React.useState<string | undefined>();
  const hasReviewer = !!document.reviewerId;

  const debouncedFetch = React.useMemo(
    () => debounce((q: string) => users.fetchPage({ query: q }), 250),
    [users]
  );

  React.useEffect(() => {
    void users.fetchPage({ limit: 100 });
  }, [users]);

  const handleFilter = React.useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(ev.target.value);
      void debouncedFetch(ev.target.value);
    },
    [debouncedFetch]
  );

  const handleSelect = React.useCallback((candidate: User) => {
    setSelectedId(candidate.id);
    setError(undefined);
  }, []);

  const handleSubmit = async () => {
    if (!selectedId) {
      return false;
    }
    try {
      await document.requestReview(selectedId);
    } catch (err) {
      // Problems with the chosen reviewer are shown next to the list so a
      // different person can be picked, anything else is shown as a toast.
      if (err instanceof BadRequestError) {
        setError(err.message);
        return false;
      }
      throw err;
    }
    onRequested();
    return true;
  };

  const candidates = users.reviewCandidates(user.id, query);

  return (
    <ConfirmationDialog
      onSubmit={handleSubmit}
      submitText={
        // Sending it back to the same reviewer is a new request, not a change.
        document.canRequestReviewAgain && selectedId === document.reviewerId
          ? t("Request review again")
          : hasReviewer
            ? t("Change reviewer")
            : t("Request review")
      }
      savingText={`${t("Requesting")}…`}
      disabled={!selectedId}
    >
      <Flex column gap={8}>
        {t(
          "Choose a teammate to review this document. They need to be able to read it."
        )}
        <Input
          type="search"
          placeholder={`${t("Search by name")}…`}
          value={query}
          onChange={handleFilter}
          label={t("Search people")}
          labelHidden
          autoFocus
          flex
        />
        <Results>
          {candidates.length === 0 ? (
            <Empty>{t("No matching people")}</Empty>
          ) : (
            candidates.map((candidate) => (
              <ListItem
                key={candidate.id}
                title={candidate.name}
                image={<Avatar model={candidate} size={AvatarSize.Medium} />}
                onClick={() => handleSelect(candidate)}
                actions={
                  candidate.id === selectedId ? (
                    <CheckmarkIcon aria-label={t("Selected")} />
                  ) : null
                }
                aria-selected={candidate.id === selectedId}
                small
              />
            ))
          )}
        </Results>
        {error && (
          <Text type="danger" size="small" role="alert">
            {error}
            {error === NO_ACCESS_MESSAGE && (
              <>
                {" "}
                <ButtonLink onClick={onShare}>{t("Share document")}</ButtonLink>
              </>
            )}
          </Text>
        )}
      </Flex>
    </ConfirmationDialog>
  );
}

const Results = styled.div`
  max-height: 40vh;
  overflow-y: auto;
  border-top: 1px solid ${s("divider")};
`;

export default observer(RequestReviewDialog);
