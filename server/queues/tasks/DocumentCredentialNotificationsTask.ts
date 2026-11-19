import { difference } from "es-toolkit/compat";
import { NotificationEventType, UserRole } from "@shared/types";
import { scanForCredentials } from "@shared/utils/credentialPatterns";
import Logger from "@server/logging/Logger";
import { Notification, Revision, User } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import type { RevisionEvent } from "@server/types";
import { canUserAccessDocument } from "@server/utils/permissions";
import { BaseTask, TaskPriority } from "./base/BaseTask";

/**
 * Notification task that alerts workspace admins when a saved revision of a
 * document introduces a potential credential. Detection runs server-side so
 * admins are notified even if the author dismissed the in-editor warning.
 */
export default class DocumentCredentialNotificationsTask extends BaseTask<RevisionEvent> {
  public async perform(event: RevisionEvent) {
    const revision = await Revision.findByPk(event.modelId);
    if (!revision) {
      return;
    }

    const credentialTypes = await this.findNewCredentialTypes(revision);
    if (credentialTypes.length === 0) {
      return;
    }

    const admins = await User.findAll({
      where: {
        teamId: event.teamId,
        role: UserRole.Admin,
        suspendedAt: null,
      },
    });

    for (const admin of admins) {
      if (admin.id === event.actorId) {
        continue;
      }
      if (
        !admin.subscribedToEventType(NotificationEventType.CredentialDetected)
      ) {
        continue;
      }
      // Avoid leaking the title of documents the admin cannot see, such as
      // drafts or documents in private collections.
      if (!(await canUserAccessDocument(admin, event.documentId))) {
        continue;
      }

      await Notification.create({
        event: NotificationEventType.CredentialDetected,
        userId: admin.id,
        actorId: event.actorId,
        teamId: event.teamId,
        documentId: event.documentId,
        revisionId: revision.id,
        data: { credentialTypes },
      });
    }

    Logger.debug("task", "Credential detected notifications processed", {
      documentId: event.documentId,
      revisionId: revision.id,
      credentialTypes,
    });
  }

  /**
   * Returns credential types present in the revision that were not present in
   * the previous revision, so admins are only notified once per introduction.
   *
   * @param revision The revision to scan.
   * @returns The names of newly introduced credential types.
   */
  private async findNewCredentialTypes(revision: Revision): Promise<string[]> {
    const current = scanForCredentials(DocumentHelper.toPlainText(revision));
    if (current.length === 0) {
      return [];
    }

    const before = await revision.before();
    const previous = before
      ? scanForCredentials(DocumentHelper.toPlainText(before))
      : [];

    return difference(current, previous);
  }

  public get options() {
    return {
      priority: TaskPriority.Background,
    };
  }
}
