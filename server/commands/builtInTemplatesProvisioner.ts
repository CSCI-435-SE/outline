import type { Transaction } from "sequelize";
import { Op } from "sequelize";
import { Template } from "@server/models";
import type { User } from "@server/models";
import { ProsemirrorHelper } from "@server/models/helpers/ProsemirrorHelper";
import { builtInTemplates } from "@server/onboarding/templates";

interface Props {
  /** The user that will be recorded as the creator of the seeded templates. */
  user: User;
  /** An optional transaction to perform the seeding within. */
  transaction?: Transaction;
}

/**
 * Seeds the built-in templates into the user's workspace as workspace
 * templates. Templates that were previously seeded are skipped, including ones
 * that have since been deleted, so the command is safe to run more than once.
 *
 * @param props The properties of the provisioner.
 * @returns The templates that were created.
 */
export default async function builtInTemplatesProvisioner({
  user,
  transaction,
}: Props): Promise<Template[]> {
  const existing = await Template.unscoped().findAll({
    attributes: ["title"],
    where: {
      teamId: user.teamId,
      template: true,
      isBuiltIn: true,
      title: { [Op.in]: builtInTemplates.map((t) => t.title) },
    },
    paranoid: false,
    transaction,
  });
  const existingTitles = new Set(existing.map((t) => t.title));

  const missing = builtInTemplates.filter((t) => !existingTitles.has(t.title));
  if (!missing.length) {
    return [];
  }

  const now = new Date();

  return Promise.all(
    missing.map((builtIn) =>
      Template.create(
        {
          title: builtIn.title,
          description: builtIn.description,
          icon: builtIn.icon,
          content: ProsemirrorHelper.toProsemirror(builtIn.text).toJSON(),
          isBuiltIn: true,
          teamId: user.teamId,
          collectionId: null,
          createdById: user.id,
          lastModifiedById: user.id,
          publishedAt: now,
        },
        { transaction }
      )
    )
  );
}
