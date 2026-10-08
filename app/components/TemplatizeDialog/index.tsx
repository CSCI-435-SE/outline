import invariant from "invariant";
import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation, Trans } from "react-i18next";
import { useHistory } from "react-router-dom";
import { toast } from "sonner";
import { DocumentValidation, TemplateValidation } from "@shared/validations";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import Switch from "~/components/Switch";
import useStores from "~/hooks/useStores";
import SelectLocation from "./SelectLocation";

type Props = {
  documentId: string;
};

function DocumentTemplatizeDialog({ documentId }: Props) {
  const history = useHistory();
  const { t } = useTranslation();
  const { documents, templates } = useStores();
  const document = documents.get(documentId);
  invariant(document, "Document must exist");

  const [publish, setPublish] = React.useState(true);
  const [title, setTitle] = React.useState(document.title);
  const [description, setDescription] = React.useState("");
  const [collectionId, setCollectionId] = React.useState(
    document.collectionId ?? null
  );

  const handleSubmit = React.useCallback(async () => {
    const template = await templates.templatize({
      id: documentId,
      collectionId,
      publish,
      title,
      description,
    });

    if (template) {
      history.push(template.path);
      toast.success(t("Template created, go ahead and customize it"));
    }
  }, [
    t,
    templates,
    documentId,
    history,
    collectionId,
    publish,
    title,
    description,
  ]);

  const handleChangeTitle = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(event.target.value);
    },
    []
  );

  const handleChangeDescription = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setDescription(event.target.value);
    },
    []
  );

  return (
    <ConfirmationDialog
      onSubmit={handleSubmit}
      submitText={t("Create template")}
      savingText={`${t("Creating")}…`}
      disabled={!title.trim()}
    >
      <Flex column gap={12}>
        <div>
          <Trans
            defaults="Creating a template from <em>{{titleWithDefault}}</em> is a non-destructive action – we'll make a copy of the document and turn it into a template that can be used as a starting point for new documents."
            values={{
              titleWithDefault: document.titleWithDefault,
            }}
            components={{
              em: <strong />,
            }}
          />
        </div>
        <Input
          label={t("Name")}
          value={title}
          onChange={handleChangeTitle}
          maxLength={DocumentValidation.maxTitleLength}
          placeholder={document.titleWithDefault}
          margin={0}
          required
          autoFocus
        />
        <Input
          label={t("Description")}
          value={description}
          onChange={handleChangeDescription}
          maxLength={TemplateValidation.maxDescriptionLength}
          placeholder={t("Briefly describe when to use this template")}
          margin={0}
        />
        <SelectLocation
          defaultCollectionId={collectionId}
          onSelect={setCollectionId}
        />
        <Switch
          name="publish"
          label={t("Published")}
          note={t("Enable other members to use the template immediately")}
          checked={publish}
          onChange={setPublish}
        />
      </Flex>
    </ConfirmationDialog>
  );
}

export default observer(DocumentTemplatizeDialog);
