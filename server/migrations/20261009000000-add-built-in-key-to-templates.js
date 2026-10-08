"use strict";

// Keys for the built-in templates seeded before this column existed, matched
// by their original titles.
const keysByTitle = {
  "Meeting notes": "meeting-notes",
  "Project brief": "project-brief",
  Retrospective: "retrospective",
  "Bug report": "bug-report",
  "Decision record": "decision-record",
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "documents",
        "builtInKey",
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
        { transaction }
      );

      for (const [title, key] of Object.entries(keysByTitle)) {
        await queryInterface.sequelize.query(
          `UPDATE documents SET "builtInKey" = :key
           WHERE "isBuiltIn" = true AND template = true AND title = :title AND "builtInKey" IS NULL`,
          { replacements: { key, title }, transaction }
        );
      }

      await queryInterface.addIndex("documents", ["teamId", "builtInKey"], {
        name: "documents_team_id_built_in_key",
        unique: true,
        where: { builtInKey: { [Sequelize.Op.ne]: null } },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(
        "documents",
        "documents_team_id_built_in_key",
        { transaction }
      );
      await queryInterface.removeColumn("documents", "builtInKey", {
        transaction,
      });
    });
  },
};
