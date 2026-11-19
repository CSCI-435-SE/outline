import { NotificationEventType } from "@shared/types";
import { createContext } from "@server/context";
import { parser } from "@server/editor";
import type { Document, User } from "@server/models";
import { Notification, Revision } from "@server/models";
import {
  buildAdmin,
  buildDocument,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import DocumentCredentialNotificationsTask from "./DocumentCredentialNotificationsTask";

const ip = "127.0.0.1";
const awsKey = `AKIA${"A".repeat(16)}`;
const githubToken = `ghp_${"a1".repeat(18)}`;

function setText(document: Document, text: string) {
  document.content = parser.parse(text)?.toJSON();
  document.updatedAt = new Date();
  return document;
}

async function saveRevision(user: User, document: Document, text: string) {
  return Revision.createFromDocument(
    createContext({ user }),
    setText(document, text)
  );
}

async function perform(revision: Revision, actor: User) {
  await new DocumentCredentialNotificationsTask().perform({
    name: "revisions.create",
    documentId: revision.documentId,
    modelId: revision.id,
    teamId: actor.teamId,
    actorId: actor.id,
    ip,
  });
}

describe("DocumentCredentialNotificationsTask", () => {
  let team: Awaited<ReturnType<typeof buildTeam>>;
  let author: User;
  let admin: User;
  let document: Document;

  beforeEach(async () => {
    vi.restoreAllMocks();
    team = await buildTeam();
    author = await buildUser({ teamId: team.id });
    admin = await buildAdmin({ teamId: team.id });
    document = await buildDocument({ teamId: team.id, userId: author.id });
  });

  it("notifies admins with the credential type when a credential is added", async () => {
    await saveRevision(author, document, "Nothing secret here");
    const revision = await saveRevision(author, document, `key: ${awsKey}`);

    await perform(revision, author);

    const notifications = await Notification.findAll({
      where: { userId: admin.id, documentId: document.id },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].event).toBe(
      NotificationEventType.CredentialDetected
    );
    expect(notifications[0].data).toEqual({
      credentialTypes: ["AWS Access Key ID"],
    });
  });

  it("never stores the credential value", async () => {
    const revision = await saveRevision(author, document, `key: ${awsKey}`);

    await perform(revision, author);

    const notification = await Notification.findOne({
      where: { userId: admin.id },
    });
    expect(JSON.stringify(notification?.toJSON())).not.toContain(awsKey);
  });

  it("does not notify again when the credential was already present", async () => {
    await saveRevision(author, document, `key: ${awsKey}`);
    const revision = await saveRevision(
      author,
      document,
      `key: ${awsKey}\nmore text`
    );
    const spy = vi.spyOn(Notification, "create");

    await perform(revision, author);

    expect(spy).not.toHaveBeenCalled();
  });

  it("only names newly introduced credential types", async () => {
    await saveRevision(author, document, `key: ${awsKey}`);
    const revision = await saveRevision(
      author,
      document,
      `key: ${awsKey}\ntoken: ${githubToken}`
    );

    await perform(revision, author);

    const notification = await Notification.findOne({
      where: { userId: admin.id },
    });
    expect(notification?.data).toEqual({ credentialTypes: ["GitHub Token"] });
  });

  it("does not notify when no credential is present", async () => {
    const revision = await saveRevision(author, document, "Just prose");
    const spy = vi.spyOn(Notification, "create");

    await perform(revision, author);

    expect(spy).not.toHaveBeenCalled();
  });

  it("does not notify non-admins", async () => {
    const member = await buildUser({ teamId: team.id });
    const revision = await saveRevision(author, document, `key: ${awsKey}`);

    await perform(revision, author);

    expect(await Notification.count({ where: { userId: member.id } })).toBe(0);
  });

  it("does not notify the admin who saved the credential", async () => {
    const revision = await saveRevision(admin, document, `key: ${awsKey}`);

    await perform(revision, admin);

    expect(await Notification.count({ where: { userId: admin.id } })).toBe(0);
  });

  it("does not notify admins who cannot access the document", async () => {
    const draft = await buildDocument({
      teamId: team.id,
      userId: author.id,
      collectionId: null,
    });
    const revision = await saveRevision(author, draft, `key: ${awsKey}`);

    await perform(revision, author);

    expect(await Notification.count({ where: { userId: admin.id } })).toBe(0);
  });

  it("does nothing when the revision no longer exists", async () => {
    const spy = vi.spyOn(Notification, "create");

    await expect(
      new DocumentCredentialNotificationsTask().perform({
        name: "revisions.create",
        documentId: document.id,
        modelId: "6f0e7a5c-2a7b-4c1e-9d6a-0b6f4b8f2a11",
        teamId: team.id,
        actorId: author.id,
        ip,
      })
    ).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not notify admins who opted out", async () => {
    admin.setNotificationEventType(
      NotificationEventType.CredentialDetected,
      false
    );
    await admin.save();
    const revision = await saveRevision(author, document, `key: ${awsKey}`);

    await perform(revision, author);

    expect(await Notification.count({ where: { userId: admin.id } })).toBe(0);
  });
});
