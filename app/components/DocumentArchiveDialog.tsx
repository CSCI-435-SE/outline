import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DocumentValidation } from "@shared/validations";
import type Document from "~/models/Document";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Input from "~/components/Input";

type Props = {
  /** The document to archive */
  document: Document;
};

function DocumentArchiveDialog({ document }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = React.useState("");

  const handleSubmit = async () => {
    await document.archive(reason.trim() || undefined);
    toast.success(t("Document archived"));
  };

  const handleChange = (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(ev.target.value);
  };

  return (
    <ConfirmationDialog
      onSubmit={handleSubmit}
      submitText={t("Archive")}
      savingText={`${t("Archiving")}…`}
    >
      {t(
        "Archiving this document will remove it from the collection and search results."
      )}
      <Input
        type="textarea"
        name="reason"
        label={t("Reason (optional)")}
        placeholder={t("Let others know why this document was archived")}
        onChange={handleChange}
        value={reason}
        maxLength={DocumentValidation.maxArchivedReasonLength}
        flex
      />
    </ConfirmationDialog>
  );
}

export default observer(DocumentArchiveDialog);
