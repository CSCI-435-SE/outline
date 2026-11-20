import {
  buildDocument,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { getCredentialScanReport } from "@server/utils/credentialScanStore";
import CredentialScanTask from "./CredentialScanTask";

const awsKey = `AKIA${"A".repeat(16)}`;

async function runScan(teamId: string) {
  await new CredentialScanTask().perform({
    teamId,
    startedAt: new Date().toISOString(),
  });
  return getCredentialScanReport(teamId);
}

describe("CredentialScanTask", () => {
  it("reports a document containing a credential by title, link and type", async () => {
    const team = await buildTeam();
    const user = await buildUser({ teamId: team.id });
    const document = await buildDocument({
      teamId: team.id,
      userId: user.id,
      title: "Setup guide",
      text: `Use this key: ${awsKey}`,
    });

    const report = await runScan(team.id);

    expect(report?.status).toBe("completed");
    expect(report?.results).toEqual([
      {
        documentId: document.id,
        urlId: document.urlId,
        title: "Setup guide",
        path: `/doc/setup-guide-${document.urlId}`,
        matches: ["AWS Access Key ID"],
      },
    ]);
  });

  it("does not report a document without credentials", async () => {
    const team = await buildTeam();
    const user = await buildUser({ teamId: team.id });
    await buildDocument({
      teamId: team.id,
      userId: user.id,
      text: "Just a normal document.",
    });

    const report = await runScan(team.id);

    expect(report?.documentsScanned).toBe(1);
    expect(report?.results).toHaveLength(0);
  });

  it("never stores the matched value in the report", async () => {
    const team = await buildTeam();
    const user = await buildUser({ teamId: team.id });
    await buildDocument({
      teamId: team.id,
      userId: user.id,
      text: `key ${awsKey}`,
    });

    const report = await runScan(team.id);

    expect(report?.results).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain(awsKey);
  });

  it("only scans documents in the requested workspace", async () => {
    const team = await buildTeam();
    const otherTeam = await buildTeam();
    const otherUser = await buildUser({ teamId: otherTeam.id });
    await buildDocument({
      teamId: otherTeam.id,
      userId: otherUser.id,
      text: `key ${awsKey}`,
    });

    const report = await runScan(team.id);

    expect(report?.documentsScanned).toBe(0);
    expect(report?.results).toHaveLength(0);
  });
});