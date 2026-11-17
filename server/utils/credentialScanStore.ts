import Redis from "@server/storage/redis";

export type CredentialScanResult = {
    documentId: string;
    urlId: string;
    title: string;
    /** Frontend path to the document, built with the model's own rule. */
    path: string;
    /** Names of the credential types found. Matched text is never stored. */
    matches: string[];
};

export type CredentialScanReport = {
    status: "running" | "completed" | "failed";
    startedAt: string;
    completedAt?: string;
    documentsScanned: number;
    results: CredentialScanResult[];
};

const TTL_SECONDS = 7 * 24 * 60 * 60;

const keyFor = (teamId: string) => `credential-scan:${teamId}`;

export async function getCredentialScanReport(
    teamId: string
): Promise<CredentialScanReport | null> {
    const raw = await Redis.defaultClient.get(keyFor(teamId));
    return raw ? (JSON.parse(raw) as CredentialScanReport) : null;
}

export async function saveCredentialScanReport(
    teamId: string,
    report: CredentialScanReport
) {
    await Redis.defaultClient.set(
        keyFor(teamId),
        JSON.stringify(report),
        "EX",
        TTL_SECONDS
    );
}