import { Op } from "sequelize";
import { uniq, uniqBy } from "es-toolkit/compat";
import {
  NotificationEventType,
  DocumentPermission,
  CollectionPermission,
  UserRole,
} from "@shared/types";
import Logger from "@server/logging/Logger";
import {
  Document,
  Notification,
  User,
  Collection,
  AccessRequest,
} from "@server/models";
import { AccessRequestStatus } from "@server/models/AccessRequest";
import { can } from "@server/policies";
import type { AccessRequestEvent } from "@server/types";
import { BaseTask, TaskPriority } from "./base/BaseTask";

/**
 * Notification task that sends notifications to users who can manage a document
 * when someone requests access to it.
 */
export default class DocumentAccessRequestNotificationsTask extends BaseTask<AccessRequestEvent> {
  public async perform(event: AccessRequestEvent) {
    const document = await Document.findByPk(event.documentId);
    if (!document) {
      Logger.debug(
        "task",
        `Document not found for access request notification`,
        {
          documentId: event.documentId,
        }
      );
      return;
    }

    const accessRequest = await AccessRequest.findByPk(event.modelId);
    if (
      !accessRequest ||
      accessRequest.status !== AccessRequestStatus.Pending
    ) {
      Logger.debug("task", `Access request not pending for notification`, {
        documentId: event.documentId,
        accessRequestId: event.modelId,
      });
      return;
    }

    const recipients = uniqBy(
      [
        ...(await this.findWorkspaceAdmins(document)),
        ...(await this.findDocumentManagers(document)),
      ],
      "id"
    );
    Logger.debug("task", "Access request notification recipients", {
      documentId: event.documentId,
      accessRequestId: event.modelId,
      recipientIds: recipients.map((r) => r.id),
    });

    for (const recipient of recipients) {
      if (recipient.id === event.actorId) {
        Logger.debug("task", "Skipping recipient: is the actor", {
          documentId: event.documentId,
          recipientId: recipient.id,
        });
        continue;
      }
      if (
        !recipient.subscribedToEventType(
          NotificationEventType.RequestDocumentAccess
        )
      ) {
        Logger.debug("task", "Skipping recipient: not subscribed", {
          documentId: event.documentId,
          recipientId: recipient.id,
        });
        continue;
      }

      await Notification.create({
        event: NotificationEventType.RequestDocumentAccess,
        userId: recipient.id,
        actorId: event.actorId,
        teamId: event.teamId,
        documentId: event.documentId,
        accessRequestId: accessRequest.id,
      });
    }
  }

  /**
   * Find the workspace admins who can grant access to the document. Admins
   * who cannot manage it, e.g. in a private collection they are not a member
   * of, could not approve the request, so they are not notified.
   *
   * @param document - the document access was requested to.
   * @returns list of active workspace admins who can manage the document.
   */
  private async findWorkspaceAdmins(document: Document): Promise<User[]> {
    const admins = await User.findAll({
      where: {
        teamId: document.teamId,
        role: UserRole.Admin,
        suspendedAt: null,
      },
    });

    const canManage = await Promise.all(
      admins.map(async (admin) => {
        const scopedDocument = await Document.findByPk(document.id, {
          userId: admin.id,
        });
        return !!scopedDocument && can(admin, "manageUsers", scopedDocument);
      })
    );

    return admins.filter((_admin, index) => canManage[index]);
  }

  /**
   * Find users who can manage the document, with tiered fallback:
   * document admins → collection admins. The first tier with any users is
   * used.
   *
   * @param document - the document to find managers for.
   * @returns list of users who can manage the document.
   */
  private async findDocumentManagers(document: Document): Promise<User[]> {
    const documentManagerIds = await Document.membershipUserIds(
      document.id,
      DocumentPermission.Admin
    );

    if (documentManagerIds.length > 0) {
      return this.loadUsers(documentManagerIds, document.teamId);
    }

    if (document.collectionId) {
      const collectionManagerIds = await Collection.membershipUserIds(
        document.collectionId,
        CollectionPermission.Admin
      );
      if (collectionManagerIds.length > 0) {
        return this.loadUsers(collectionManagerIds, document.teamId);
      }
    }

    return [];
  }

  private async loadUsers(ids: string[], teamId: string): Promise<User[]> {
    return User.findAll({
      where: {
        id: { [Op.in]: uniq(ids) },
        teamId,
        suspendedAt: null,
      },
    });
  }

  public get options() {
    return {
      priority: TaskPriority.Background,
    };
  }
}
