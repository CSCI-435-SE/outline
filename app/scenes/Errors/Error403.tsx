import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import Button from "~/components/Button";
import Empty from "~/components/Empty";
import Heading from "~/components/Heading";
import RequestAccessDialog from "~/components/RequestAccessDialog";
import Scene from "~/components/Scene";
import { navigateToHome } from "~/actions/definitions/navigation";
import { HStack } from "~/components/primitives/HStack";
import { VStack } from "~/components/primitives/VStack";
import useCurrentUser from "~/hooks/useCurrentUser";
import useStores from "~/hooks/useStores";
import Loading from "~/scenes/Document/components/Loading";
import { client } from "~/utils/ApiClient";

type Props = {
  /** The document ID to request access to. */
  documentId?: string;
  /** Whether the inaccessible resource is a collection rather than a document. */
  isCollection?: boolean;
};

const Error403 = ({ documentId, isCollection }: Props) => {
  const { t } = useTranslation();
  const location = useLocation<{ title?: string }>();
  const history = useHistory();
  const { dialogs } = useStores();
  const user = useCurrentUser({ rejectOnEmpty: false });
  const canRequest = !!documentId && !!user;
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(canRequest);

  useEffect(() => {
    if (!documentId || !user) {
      return;
    }

    const checkRequested = async () => {
      try {
        const request = await client.post("/accessRequests.info", {
          documentId,
        });
        setRequested(request?.data?.status === "pending");
      } catch {
        // No pending request or error — leave as not requested
      } finally {
        setLoading(false);
      }
    };

    void checkRequested();
  }, [documentId, user]);

  const handleRequestAccess = useCallback(() => {
    if (!documentId || requested) {
      return;
    }

    dialogs.openModal({
      title: t("Request access"),
      content: (
        <RequestAccessDialog
          documentId={documentId}
          onRequested={() => setRequested(true)}
        />
      ),
    });
  }, [dialogs, documentId, requested, t]);

  const handleGoBack = useCallback(() => history.goBack(), [history]);

  if (loading) {
    return <Loading location={location} />;
  }

  const title = isCollection
    ? t("No access to this collection")
    : t("No access to this doc");

  return (
    <Scene title={title}>
      <Heading>{title}</Heading>
      <VStack spacing={20} style={{ maxWidth: 500 }} align="initial">
        {requested ? (
          <Empty size="large">
            {t(
              "Your request to access this document has been sent. You will be notified once access is granted."
            )}{" "}
          </Empty>
        ) : (
          <Empty size="large">
            {isCollection
              ? t(
                  "It doesn't look like you have permission to access this collection."
                )
              : t(
                  "It doesn't look like you have permission to access this document. You can request access."
                )}
          </Empty>
        )}
        <HStack gap={8}>
          {canRequest && (
            <Button
              onClick={handleRequestAccess}
              disabled={requested}
              neutral={requested}
            >
              {requested ? t("Access requested") : t("Request access")}
            </Button>
          )}
          <Button action={navigateToHome} hideIcon neutral={canRequest}>
            {t("Home")}
          </Button>
          <Button onClick={handleGoBack} neutral>
            {t("Go back")}
          </Button>
        </HStack>
      </VStack>
    </Scene>
  );
};

export default Error403;
