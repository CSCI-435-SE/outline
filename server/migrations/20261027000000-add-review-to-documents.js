"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "documents",
        "reviewStatus",
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
        { transaction }
      );

      for (const column of ["reviewerId", "reviewRequestedById"]) {
        await queryInterface.addColumn(
          "documents",
          column,
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "users",
              key: "id",
            },
            onDelete: "SET NULL",
          },
          { transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of [
        "reviewRequestedById",
        "reviewerId",
        "reviewStatus",
      ]) {
        await queryInterface.removeColumn("documents", column, {
          transaction,
        });
      }
    });
  },
};
