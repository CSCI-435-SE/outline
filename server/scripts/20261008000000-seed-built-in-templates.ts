import "./bootstrap";
import { UserRole } from "@shared/types";
import builtInTemplatesProvisioner from "@server/commands/builtInTemplatesProvisioner";
import { Team, User } from "@server/models";
import { sequelize } from "@server/storage/database";

/**
 * Seeds the built-in templates into every existing workspace. The earliest
 * admin of each workspace is recorded as the creator. Safe to re-run, already
 * seeded (or deleted) built-in templates are skipped.
 *
 * @param exit Whether to exit the process when complete.
 */
export default async function main(exit = false) {
  await Team.findAllInBatches<Team>(
    {
      attributes: ["id"],
      batchLimit: 10,
    },
    async (teams) => {
      for (const team of teams) {
        const admin = await User.findOne({
          where: { teamId: team.id, role: UserRole.Admin },
          order: [["createdAt", "ASC"]],
        });

        if (!admin) {
          console.log(`Skipping team ${team.id}, no admin found`);
          continue;
        }

        const created = await sequelize.transaction((transaction) =>
          builtInTemplatesProvisioner({ user: admin, transaction })
        );
        console.log(
          `Seeded ${created.length} built-in templates for team ${team.id}`
        );
      }
    }
  );

  if (exit) {
    process.exit(0);
  }
}

// In the test suite we import the script rather than run via node CLI
if (process.env.NODE_ENV !== "test") {
  void main(true);
}
