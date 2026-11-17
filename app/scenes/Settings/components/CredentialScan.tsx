import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { errToString } from "@shared/utils/error";
import Button from "~/components/Button";
import Heading from "~/components/Heading";
import Text from "~/components/Text";
import Time from "~/components/Time";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import usePolicy from "~/hooks/usePolicy";
import { client } from "~/utils/ApiClient";

type Report = {
    status: "running" | "completed" | "failed";
    startedAt: string;
    completedAt?: string;
    documentsScanned: number;
    results: {
        documentId: string;
        urlId: string;
        title: string;
        path: string;
        matches: string[];
    }[];
};

const POLL_MS = 3000;

function CredentialScan() {
    const { t } = useTranslation();
    const team = useCurrentTeam();
    const can = usePolicy(team);
    const [report, setReport] = React.useState<Report | null>(null);
    const [starting, setStarting] = React.useState(false);

    const load = React.useCallback(async () => {
        const res = await client.post("/credentialScans.info", {});
        setReport(res.data ?? null);
    }, []);

    React.useEffect(() => {
        if (can.update) {
            void load();
        }
    }, [can.update, load]);

    // Poll while a scan is running.
    React.useEffect(() => {
        if (report?.status !== "running") {
            return;
        }
        const timer = setInterval(() => void load(), POLL_MS);
        return () => clearInterval(timer);
    }, [report?.status, load]);

    const handleStart = React.useCallback(async () => {
        setStarting(true);
        try {
            const res = await client.post("/credentialScans.start", {});
            setReport(res.data);
        } catch (err) {
            toast.error(errToString(err));
        } finally {
            setStarting(false);
        }
    }, []);

    // The report is for admins only.
    if (!can.update) {
        return null;
    }

    const running = report?.status === "running";

    return (
        <>
            <Heading as="h2">{t("Credential scan")}</Heading>
            <Text as="p" type="secondary">
                {t(
                    "Scan all existing documents for text that looks like a credential, such as API keys and private keys. Only the type of credential is shown, never the value."
                )}
            </Text>
            <Button onClick={handleStart} disabled={starting || running} neutral>
                {running ? `${t("Scanning")}…` : t("Scan all documents for credentials")}
            </Button>

            {report?.status === "failed" && (
                <Text as="p" type="danger">
                    {t("The last scan failed. Please try again.")}
                </Text>
            )}

            {report?.status === "completed" && (
                <>
                    <Text as="p" type="secondary" style={{ marginTop: 12 }}>
                        {t("Scanned {{ count }} documents", {
                            count: report.documentsScanned,
                        })}
                        {report.completedAt && (
                            <>
                                {" · "}
                                <Time dateTime={report.completedAt} relative addSuffix />
                            </>
                        )}
                    </Text>
                    {report.results.length === 0 ? (
                        <Text as="p">{t("No potential credentials were found.")}</Text>
                    ) : (
                        <table style={{ width: "100%", marginTop: 8 }}>
                            <thead>
                                <tr>
                                    <th align="left">{t("Document")}</th>
                                    <th align="left">{t("Match type")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.results.map((result) => (
                                    <tr key={result.documentId}>
                                        <td>
                                            <Link to={result.path}>
                                                {result.title || t("Untitled")}
                                            </Link>
                                        </td>
                                        <td>{result.matches.join(", ")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </>
    );
}

export default observer(CredentialScan);