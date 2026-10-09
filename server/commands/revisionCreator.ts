import { createContext } from "@server/context";
import type { User, Document } from "@server/models";
import { Revision } from "@server/models";
import { sequelize } from "@server/storage/database";
import type { DocumentEvent, RevisionEvent } from "@server/types";

export default async function revisionCreator({
  event,
  document,
  collaboratorIds,
  user,
  message,
}: {
  event: DocumentEvent | RevisionEvent;
  document: Document;
  collaboratorIds: string[];
  user: User;
  /** An optional commit-style message describing why this change was made */
  message?: string;
}) {
  return sequelize.transaction(
    async (transaction) =>
      await Revision.createFromDocument(
        createContext({
          user,
          authType: event.authType,
          ip: event.ip,
          transaction,
        }),
        document,
        collaboratorIds,
        message
      )
  );
}
