import { vi } from "vitest";
import CredentialScanTask from "@server/queues/tasks/CredentialScanTask";
import { buildAdmin, buildTeam, buildUser } from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import { saveCredentialScanReport } from "@server/utils/credentialScanStore";

const server = getTestServer();

describe("credentialScans", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("#credentialScans.start", () => {
    it("rejects a non-admin", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });

      const res = await server.post("/api/credentialScans.start", user, {
        body: {},
      });

      expect(res.status).toEqual(403);
    });

    it("lets an admin start a scan that runs in the background", async () => {
      const schedule = vi
        .spyOn(CredentialScanTask.prototype, "schedule")
        .mockResolvedValue({} as never);
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });

      const res = await server.post("/api/credentialScans.start", admin, {
        body: {},
      });
      const body = await res.json();

      expect(res.status).toEqual(200);
      expect(body.data.status).toEqual("running");
      expect(schedule).toHaveBeenCalledTimes(1);
    });

    it("does not start a second scan while one is running", async () => {
      const schedule = vi
        .spyOn(CredentialScanTask.prototype, "schedule")
        .mockResolvedValue({} as never);
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });

      await server.post("/api/credentialScans.start", admin, { body: {} });
      const res = await server.post("/api/credentialScans.start", admin, {
        body: {},
      });
      const body = await res.json();

      expect(body.data.status).toEqual("running");
      expect(schedule).toHaveBeenCalledTimes(1);
    });

    it("allows the scan to be re-run after it completed", async () => {
      const schedule = vi
        .spyOn(CredentialScanTask.prototype, "schedule")
        .mockResolvedValue({} as never);
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });
      await saveCredentialScanReport(team.id, {
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        documentsScanned: 3,
        results: [],
      });

      const res = await server.post("/api/credentialScans.start", admin, {
        body: {},
      });
      const body = await res.json();

      expect(body.data.status).toEqual("running");
      expect(schedule).toHaveBeenCalledTimes(1);
    });
  });

  describe("#credentialScans.info", () => {
    it("rejects a non-admin", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });

      const res = await server.post("/api/credentialScans.info", user, {
        body: {},
      });

      expect(res.status).toEqual(403);
    });

    it("returns null when no scan has been run", async () => {
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });

      const res = await server.post("/api/credentialScans.info", admin, {
        body: {},
      });
      const body = await res.json();

      expect(res.status).toEqual(200);
      expect(body.data).toBeNull();
    });

    it("returns the stored report to an admin", async () => {
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });
      await saveCredentialScanReport(team.id, {
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        documentsScanned: 1,
        results: [
          {
            documentId: "doc-1",
            urlId: "abc123",
            title: "Setup guide",
            path: "/doc/setup-guide-abc123",
            matches: ["AWS Access Key ID"],
          },
        ],
      });

      const res = await server.post("/api/credentialScans.info", admin, {
        body: {},
      });
      const body = await res.json();

      expect(body.data.results[0].title).toEqual("Setup guide");
      expect(body.data.results[0].matches).toEqual(["AWS Access Key ID"]);
    });
  });
});