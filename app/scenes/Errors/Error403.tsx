import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { errToString } from "@shared/utils/error";
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
import { NotFoundError } from "~/utils/errors";

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

    // Ignore the result if the user has navigated away in the meantime.
    let cancelled = false;

    const checkRequested = async () => {
      try {
        const request = await client.post("/accessRequests.info", {
          documentId,
        });
        if (!cancelled) {
          setRequested(request?.data?.status === "pending");
        }
      } catch (err) {
        // A 404 means there is no pending request; any other failure leaves the
        // status unknown, so surface it instead of treating it as "not requested".
        if (!cancelled && !(err instanceof NotFoundError)) {
          toast.error(errToString(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void checkRequested();

    return () => {
      cancelled = true;
    };
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
              : canRequest
                ? t(
                    "It doesn't look like you have permission to access this document. You can request access."
                  )
                : t(
                    "It doesn't look like you have permission to access this document."
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
