import { Event } from "@server/models";
import { buildDocument, buildUser } from "@server/test/factories";
import type { DocumentEvent } from "@server/types";
import { AuthenticationType } from "@server/types";
import revisionCreator from "./revisionCreator";

describe("revisionCreator", () => {
  it("should create revision model from document", async () => {
    const user = await buildUser();
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
    });
    const revision = await revisionCreator({
      document,
      user,
      collaboratorIds: [user.id],
      event: {
        name: "documents.update",
        authType: AuthenticationType.APP,
      } as DocumentEvent,
    });
    const event = await Event.findLatest({
      teamId: user.teamId,
    });
    expect(revision.documentId).toEqual(document.id);
    expect(revision.userId).toEqual(user.id);
    expect(revision.createdAt).toEqual(document.updatedAt);
    expect(event!.name).toEqual("revisions.create");
    expect(event!.modelId).toEqual(revision.id);
    expect(event!.authType).toEqual(AuthenticationType.APP);
  });

  it("should record the commit message on the revision", async () => {
    const user = await buildUser();
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
    });
    const revision = await revisionCreator({
      document,
      user,
      collaboratorIds: [user.id],
      message: "Fixed a typo in the intro",
      event: {
        name: "documents.publish",
        authType: AuthenticationType.APP,
      } as DocumentEvent,
    });

    expect(revision.name).toEqual("Fixed a typo in the intro");
  });
});
