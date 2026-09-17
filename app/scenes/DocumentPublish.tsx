import { observer } from "mobx-react";
import type { ChangeEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { ellipsis } from "@shared/styles";
import type { NavigationNode } from "@shared/types";
import { RevisionValidation } from "@shared/validations";
import type Document from "~/models/Document";
import Button from "~/components/Button";
import DocumentExplorer from "~/components/DocumentExplorer";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import Text from "~/components/Text";
import useCollectionTrees from "~/hooks/useCollectionTrees";
import useStores from "~/hooks/useStores";

type Props = {
  /** Document to publish */
  document: Document;
};

function DocumentPublish({ document }: Props) {
  const { dialogs, policies } = useStores();
  const { t } = useTranslation();
  const collectionTrees = useCollectionTrees();
  const hasDestination = !!document.collectionId;
  const [selectedPath, selectPath] = useState<NavigationNode | null>(null);
  const [message, setMessage] = useState("");
  const publishOptions = useMemo(
    () =>
      collectionTrees.filter((node) =>
        node.collectionId
          ? policies.get(node.collectionId)?.abilities.createDocument
          : true
      ),
    [policies, collectionTrees]
  );

  const handleMessageChange = (ev: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(ev.target.value);
  };

  const canPublish = hasDestination
    ? !!message.trim()
    : !!selectedPath && !!message.trim();

  const publish = async (path = selectedPath) => {
    if (!hasDestination && !path) {
      toast.message(t("Select a location to publish"));
      return;
    }

    if (!message.trim()) {
      toast.message(t("Enter a message describing this change"));
      return;
    }

    try {
      if (!hasDestination && path) {
        const { type, id: parentDocumentId } = path;
        const collectionId = path.collectionId as string;

        // Also move it under if selected path corresponds to another doc
        if (type === "document") {
          await document.move({ collectionId, parentDocumentId });
        }

        document.collectionId = collectionId;
      }

      await document.save(undefined, {
        publish: true,
        message: message.trim(),
      });

      toast.success(t("Document published"));

      dialogs.closeAllModals();
    } catch (_err) {
      toast.error(t("Couldn’t publish the document, try again?"));
    }
  };

  return (
    <FlexContainer column>
      {!hasDestination && (
        <DocumentExplorer
          items={publishOptions}
          onSubmit={publish}
          onSelect={selectPath}
        />
      )}
      <MessageInputWrapper>
        <Input
          type="textarea"
          autoFocus={hasDestination}
          autoSize
          minHeight="3lh"
          maxHeight="10lh"
          maxLength={RevisionValidation.maxNameLength}
          label={t("Message")}
          labelHidden
          placeholder={t("Describe what changed and why…")}
          value={message}
          onChange={handleMessageChange}
          onRequestSubmit={() => publish()}
        />
      </MessageInputWrapper>
      <Footer justify="space-between" align="center" gap={8}>
        <StyledText type="secondary">
          {hasDestination ? (
            t("Describe your changes")
          ) : selectedPath ? (
            <Trans
              defaults="Publish in <em>{{ location }}</em>"
              values={{
                location: selectedPath.title,
              }}
              components={{
                em: <strong />,
              }}
            />
          ) : (
            t("Select a location to publish")
          )}
        </StyledText>
        <Button disabled={!canPublish} onClick={() => publish()}>
          {t("Publish")}
        </Button>
      </Footer>
    </FlexContainer>
  );
}

const FlexContainer = styled(Flex)`
  margin-left: -24px;
  margin-right: -24px;
  margin-bottom: -24px;
  outline: none;
`;

const MessageInputWrapper = styled.div`
  padding: 0 24px;
`;

const Footer = styled(Flex)`
  height: 64px;
  border-top: 1px solid ${(props) => props.theme.horizontalRule};
  padding-left: 24px;
  padding-right: 24px;
`;

const StyledText = styled(Text)`
  ${ellipsis()}
  margin-bottom: 0;
`;

export default observer(DocumentPublish);
