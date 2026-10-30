"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "documents",
        "lastEditedAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );

      // Revisions are only created when content changes, so the most recent
      // one is a better estimate of the last edit than updatedAt, which is
      // bumped by moves, archiving, and other non-content saves.
      await queryInterface.sequelize.query(
        `UPDATE documents d
         SET "lastEditedAt" = COALESCE(
           (SELECT MAX(r."createdAt") FROM revisions r WHERE r."documentId" = d.id),
           d."updatedAt"
         )`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("documents", "lastEditedAt");
  },
};
