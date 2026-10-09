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
 * that have since been renamed or deleted, so the command is safe to run more
 * than once.
 *
 * @param props The properties of the provisioner.
 * @returns The templates that were created.
 */
export default async function builtInTemplatesProvisioner({
  user,
  transaction,
}: Props): Promise<Template[]> {
  // Match on the stable key rather than the title so that templates renamed
  // by an admin are not seeded again.
  const existing = await Template.unscoped().findAll({
    attributes: ["builtInKey"],
    where: {
      teamId: user.teamId,
      template: true,
      builtInKey: { [Op.in]: builtInTemplates.map((t) => t.key) },
    },
    paranoid: false,
    transaction,
  });
  const existingKeys = new Set(existing.map((t) => t.builtInKey));

  const missing = builtInTemplates.filter((t) => !existingKeys.has(t.key));
  if (!missing.length) {
    return [];
  }

  const now = new Date();

  // Created one at a time, a transaction's queries must not run in parallel.
  const created: Template[] = [];
  for (const builtIn of missing) {
    created.push(
      await Template.create(
        {
          title: builtIn.title,
          description: builtIn.description,
          icon: builtIn.icon,
          content: ProsemirrorHelper.toProsemirror(builtIn.text).toJSON(),
          isBuiltIn: true,
          builtInKey: builtIn.key,
          teamId: user.teamId,
          collectionId: null,
          createdById: user.id,
          lastModifiedById: user.id,
          publishedAt: now,
        },
        { transaction }
      )
    );
  }

  return created;
}
