"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "documents",
        "reviewedAt",
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "documents",
        "reviewedById",
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "users",
          },
          onDelete: "SET NULL",
        },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("documents", "reviewedById", {
        transaction,
      });
      await queryInterface.removeColumn("documents", "reviewedAt", {
        transaction,
      });
    });
  },
};
