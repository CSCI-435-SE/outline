import { Node } from "prosemirror-model";
import { prosemirrorToYDoc } from "y-prosemirror";
import { schema } from "@server/editor";
import type { Document } from "@server/models";
import { Collection } from "@server/models";
import { buildDocument, buildUser } from "@server/test/factories";
import documentCollaborativeUpdater from "./documentCollaborativeUpdater";

describe("documentCollaborativeUpdater", () => {
  const buildYDoc = (content: object[]) => {
    const doc = Node.fromJSON(schema, { type: "doc", content });
    return prosemirrorToYDoc(doc, "default");
  };

  it("persists canonical JSON without empty attrs on marks", async () => {
    const user = await buildUser();
    const document = await buildDocument({
      teamId: user.teamId,
      userId: user.id,
    });

    const ydoc = buildYDoc([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Deciders:",
            marks: [{ type: "strong" }],
          },
        ],
      },
    ]);

    await documentCollaborativeUpdater({
      documentId: document.id,
      ydoc,
      sessionCollaboratorIds: [user.id],
      isLastConnection: true,
      clientVersion: null,
    });

    await document.reload();

    const marks = JSON.stringify(document.content).match(/"attrs":\{\}/g);
    expect(marks).toBeNull();

    const text = document.content?.content?.[0]?.content?.[0];
    expect(text?.marks).toEqual([{ type: "strong" }]);
  });

  it("does not persist when content is unchanged", async () => {
    const user = await buildUser();
    const content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello" }],
      },
    ];
    const ydoc = buildYDoc(content);

    const document = await buildDocument({
      teamId: user.teamId,
      userId: user.id,
      content: Node.fromJSON(schema, { type: "doc", content }).toJSON(),
    });

    const updatedAt = document.updatedAt;

    await documentCollaborativeUpdater({
      documentId: document.id,
      ydoc,
      sessionCollaboratorIds: [user.id],
      isLastConnection: true,
      clientVersion: null,
    });

    await document.reload();
    expect(document.updatedAt).toEqual(updatedAt);
  });

  describe("lastEditedAt", () => {
    const longAgo = new Date("2026-01-01T00:00:00Z");
    const content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Edited" }],
      },
    ];

    const structureEditDate = async (document: Document) => {
      const collection = await Collection.findByPk(document.collectionId!, {
        includeDocumentStructure: true,
      });
      return collection!.documentStructure!.find(
        (node) => node.id === document.id
      )?.lastEditedAt;
    };

    it("sets lastEditedAt and refreshes the collection structure", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        teamId: user.teamId,
        userId: user.id,
      });
      await document.update({ lastEditedAt: longAgo }, { hooks: false });

      await documentCollaborativeUpdater({
        documentId: document.id,
        ydoc: buildYDoc(content),
        sessionCollaboratorIds: [user.id],
        isLastConnection: true,
        clientVersion: null,
      });

      await document.reload();
      expect(document.lastEditedAt!.getTime()).toBeGreaterThan(
        longAgo.getTime()
      );
      expect(await structureEditDate(document)).toEqual(
        document.lastEditedAt!.toISOString()
      );
    });

    it("does not refresh the collection structure within a day", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        teamId: user.teamId,
        userId: user.id,
      });
      const before = await structureEditDate(document);

      await documentCollaborativeUpdater({
        documentId: document.id,
        ydoc: buildYDoc(content),
        sessionCollaboratorIds: [user.id],
        isLastConnection: true,
        clientVersion: null,
      });

      await document.reload();
      expect(document.lastEditedAt!.toISOString()).not.toEqual(before);
      expect(await structureEditDate(document)).toEqual(before);
    });

    it("does not set lastEditedAt when content is unchanged", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        teamId: user.teamId,
        userId: user.id,
        content: Node.fromJSON(schema, { type: "doc", content }).toJSON(),
      });
      await document.update({ lastEditedAt: longAgo }, { hooks: false });

      await documentCollaborativeUpdater({
        documentId: document.id,
        ydoc: buildYDoc(content),
        sessionCollaboratorIds: [user.id],
        isLastConnection: true,
        clientVersion: null,
      });

      await document.reload();
      expect(document.lastEditedAt).toEqual(longAgo);
    });
  });
});
