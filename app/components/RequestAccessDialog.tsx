import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AccessRequestValidation } from "@shared/validations";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Input from "~/components/Input";
import { client } from "~/utils/ApiClient";

type Props = {
  /** The document to request access to. */
  documentId: string;
  /** Called once the request has been sent. */
  onRequested: () => void;
};

function RequestAccessDialog({ documentId, onRequested }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = React.useState("");

  const handleSubmit = async () => {
    await client.post("/accessRequests.create", {
      documentId,
      reason: reason.trim() || undefined,
    });
    onRequested();
    toast.success(t("Access request sent"));
  };

  const handleChange = (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReason(ev.target.value);
  };

  return (
    <ConfirmationDialog
      onSubmit={handleSubmit}
      submitText={t("Request access")}
      savingText={`${t("Requesting")}…`}
    >
      {t("A workspace admin will be notified of your request.")}
      <Input
        type="textarea"
        name="reason"
        label={t("Reason (optional)")}
        placeholder={t("Let the admin know why you need access")}
        onChange={handleChange}
        value={reason}
        maxLength={AccessRequestValidation.maxReasonLength}
        flex
      />
    </ConfirmationDialog>
  );
}

export default observer(RequestAccessDialog);
