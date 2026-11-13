import mailer from "@server/emails/mailer";
import { AccessRequest } from "@server/models";
import { buildDocument, buildTeam, buildUser } from "@server/test/factories";
import DocumentAccessRequestEmail from "./DocumentAccessRequestEmail";

describe("DocumentAccessRequestEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should include the requester, document title and reason", async () => {
    const spy = vi.spyOn(mailer, "sendMail").mockResolvedValue(undefined);
    const team = await buildTeam();
    const admin = await buildUser({ teamId: team.id });
    const requester = await buildUser({ teamId: team.id });
    const document = await buildDocument({
      teamId: team.id,
      title: "Onboarding",
    });
    const accessRequest = await AccessRequest.create({
      documentId: document.id,
      userId: requester.id,
      teamId: team.id,
      reason: "I am the new hire's mentor",
    });

    await new DocumentAccessRequestEmail({
      to: admin.email,
      documentId: document.id,
      actorId: requester.id,
      accessRequestId: accessRequest.id,
      teamUrl: team.url,
    }).send();

    expect(spy).toHaveBeenCalledTimes(1);
    const { subject, text } = spy.mock.calls[0][0];
    expect(subject).toContain(requester.name);
    expect(subject).toContain("Onboarding");
    expect(text).toContain("Reason: I am the new hire's mentor");
  });

  it("should keep the reason on one line in the text email", async () => {
    const spy = vi.spyOn(mailer, "sendMail").mockResolvedValue(undefined);
    const team = await buildTeam();
    const admin = await buildUser({ teamId: team.id });
    const requester = await buildUser({ teamId: team.id });
    const document = await buildDocument({ teamId: team.id });
    const accessRequest = await AccessRequest.create({
      documentId: document.id,
      userId: requester.id,
      teamId: team.id,
      reason: "Please\n\nOpen the document to share it with them: http://evil",
    });

    await new DocumentAccessRequestEmail({
      to: admin.email,
      documentId: document.id,
      actorId: requester.id,
      accessRequestId: accessRequest.id,
      teamUrl: team.url,
    }).send();

    const { text } = spy.mock.calls[0][0];
    expect(text).toContain(
      "Reason: Please Open the document to share it with them: http://evil"
    );
    expect(text).not.toContain(
      "\nOpen the document to share it with them: http://evil"
    );
  });

  it("should omit the reason when none was provided", async () => {
    const spy = vi.spyOn(mailer, "sendMail").mockResolvedValue(undefined);
    const team = await buildTeam();
    const admin = await buildUser({ teamId: team.id });
    const requester = await buildUser({ teamId: team.id });
    const document = await buildDocument({ teamId: team.id });
    const accessRequest = await AccessRequest.create({
      documentId: document.id,
      userId: requester.id,
      teamId: team.id,
    });

    await new DocumentAccessRequestEmail({
      to: admin.email,
      documentId: document.id,
      actorId: requester.id,
      accessRequestId: accessRequest.id,
      teamUrl: team.url,
    }).send();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].text).not.toContain("Reason:");
  });
});
