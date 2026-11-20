import { QueryTypes, Sequelize, ValidationError } from "sequelize";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import type { User } from "@server/models";
import { EmailSetting } from "@server/models";
import { sequelize } from "@server/storage/database";
import { buildAdmin } from "@server/test/factories";

/**
 * Reads the stored email settings through a brand new database connection,
 * which shares no in-memory state with the running app. This is what a server
 * sees after it restarts.
 *
 * @returns the stored rows, ordered by key.
 */
async function readAfterRestart() {
  const fresh = new Sequelize(env.DATABASE_URL ?? "", { logging: false });
  try {
    return await fresh.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM email_settings ORDER BY key`,
      { type: QueryTypes.SELECT }
    );
  } finally {
    await fresh.close();
  }
}

/**
 * Reads who last changed each stored email setting, and when, through a brand
 * new database connection.
 *
 * @returns the stored rows, ordered by key.
 */
async function readAuditAfterRestart() {
  const fresh = new Sequelize(env.DATABASE_URL ?? "", { logging: false });
  try {
    return await fresh.query<{
      key: string;
      updatedById: string | null;
      updatedAt: Date;
    }>(
      `SELECT key, "updatedById", "updatedAt" FROM email_settings ORDER BY key`,
      { type: QueryTypes.SELECT }
    );
  } finally {
    await fresh.close();
  }
}

describe("EmailSetting", () => {
  let admin: User;

  beforeEach(async () => {
    await EmailSetting.destroy({ where: {}, truncate: true });
    admin = await buildAdmin();
  });

  describe("persistence", () => {
    it("keeps saved settings after a server restart", async () => {
      await EmailSetting.create({
        key: "host",
        value: "smtp.example.com",
        updatedById: admin.id,
      });
      await EmailSetting.create({
        key: "port",
        value: 587,
        updatedById: admin.id,
      });
      await EmailSetting.create({
        key: "fromEmail",
        value: "noreply@example.com",
        updatedById: admin.id,
      });

      expect(await readAfterRestart()).toEqual([
        { key: "fromEmail", value: "noreply@example.com" },
        { key: "host", value: "smtp.example.com" },
        { key: "port", value: 587 },
      ]);
    });

    it("keeps the latest saved value after a server restart", async () => {
      const setting = await EmailSetting.create({
        key: "host",
        value: "smtp.old.example.com",
        updatedById: admin.id,
      });
      await setting.update({ value: "smtp.new.example.com" });

      expect(await readAfterRestart()).toEqual([
        { key: "host", value: "smtp.new.example.com" },
      ]);
    });
  });

  describe("validation", () => {
    it.each([
      ["0", 0],
      ["65536", 65536],
      ["a non-integer", 25.5],
      ["a non-number", "abc"],
    ])("rejects a port of %s before saving", async (_label, value) => {
      await expect(
        EmailSetting.create({ key: "port", value, updatedById: admin.id })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await EmailSetting.count()).toEqual(0);
    });

    it.each([
      ["1", 1],
      ["65535", 65535],
    ])("accepts a port of %s", async (_label, value) => {
      await EmailSetting.create({ key: "port", value, updatedById: admin.id });
      expect(await readAfterRestart()).toEqual([{ key: "port", value }]);
    });

    it.each([
      ["an empty host", ""],
      ["a host of only spaces", "   "],
    ])("rejects %s before saving", async (_label, value) => {
      await expect(
        EmailSetting.create({ key: "host", value, updatedById: admin.id })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await EmailSetting.count()).toEqual(0);
    });

    it.each([
      ["no @ sign", "not-an-email"],
      ["no domain", "noreply@"],
      ["an empty value", ""],
    ])(
      "rejects a from address with %s before saving",
      async (_label, value) => {
        await expect(
          EmailSetting.create({
            key: "fromEmail",
            value,
            updatedById: admin.id,
          })
        ).rejects.toBeInstanceOf(ValidationError);
        expect(await EmailSetting.count()).toEqual(0);
      }
    );

    it("accepts a valid from address", async () => {
      await EmailSetting.create({
        key: "fromEmail",
        value: "noreply@example.com",
        updatedById: admin.id,
      });
      expect(await readAfterRestart()).toEqual([
        { key: "fromEmail", value: "noreply@example.com" },
      ]);
    });

    it("keeps the saved value when an update is invalid", async () => {
      const setting = await EmailSetting.create({
        key: "host",
        value: "smtp.example.com",
        updatedById: admin.id,
      });

      await expect(setting.update({ value: "   " })).rejects.toBeInstanceOf(
        ValidationError
      );
      expect(await readAfterRestart()).toEqual([
        { key: "host", value: "smtp.example.com" },
      ]);
    });
  });

  describe("audit", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("records who saved a setting and when", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const savedAt = new Date("2026-03-01T10:00:00.000Z");
      vi.setSystemTime(savedAt);

      await EmailSetting.create({
        key: "host",
        value: "smtp.example.com",
        updatedById: admin.id,
      });

      expect(await readAuditAfterRestart()).toEqual([
        { key: "host", updatedById: admin.id, updatedAt: savedAt },
      ]);
    });

    it("records the latest person to change a setting and when", async () => {
      const otherAdmin = await buildAdmin();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
      const setting = await EmailSetting.create({
        key: "port",
        value: 25,
        updatedById: admin.id,
      });

      const changedAt = new Date("2026-03-02T15:30:00.000Z");
      vi.setSystemTime(changedAt);
      await setting.update({ value: 587, updatedById: otherAdmin.id });

      expect(await readAuditAfterRestart()).toEqual([
        { key: "port", updatedById: otherAdmin.id, updatedAt: changedAt },
      ]);
    });

    it("rejects a setting saved without recording who changed it", async () => {
      await expect(
        EmailSetting.create({ key: "host", value: "smtp.example.com" })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await EmailSetting.count()).toEqual(0);
    });
  });

  describe("resolve", () => {
    const original = {
      SMTP_HOST: env.SMTP_HOST,
      SMTP_PORT: env.SMTP_PORT,
      SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL,
    };

    beforeEach(() => {
      env.SMTP_HOST = "smtp.env.example.com";
      env.SMTP_PORT = 2525;
      env.SMTP_FROM_EMAIL = "env@example.com";
    });

    afterEach(() => {
      env.SMTP_HOST = original.SMTP_HOST;
      env.SMTP_PORT = original.SMTP_PORT;
      env.SMTP_FROM_EMAIL = original.SMTP_FROM_EMAIL;
    });

    it("uses the admin value when both an admin value and an environment variable exist", async () => {
      await EmailSetting.create({
        key: "host",
        value: "smtp.admin.example.com",
        updatedById: admin.id,
      });

      const settings = await EmailSetting.resolve();

      expect(settings.host).toEqual({
        value: "smtp.admin.example.com",
        source: "admin",
      });
    });

    it("uses the admin value when the environment variable is unset", async () => {
      env.SMTP_PORT = undefined;
      await EmailSetting.create({
        key: "port",
        value: 587,
        updatedById: admin.id,
      });

      const settings = await EmailSetting.resolve();

      expect(settings.port).toEqual({ value: 587, source: "admin" });
    });

    it("uses the environment variable when there is no admin value", async () => {
      await EmailSetting.create({
        key: "host",
        value: "smtp.admin.example.com",
        updatedById: admin.id,
      });

      const settings = await EmailSetting.resolve();

      expect(settings.port).toEqual({ value: 2525, source: "environment" });
      expect(settings.fromEmail).toEqual({
        value: "env@example.com",
        source: "environment",
      });
    });

    it("reports an unset value from the environment when neither exists", async () => {
      env.SMTP_FROM_EMAIL = undefined;

      const settings = await EmailSetting.resolve();

      expect(settings.fromEmail).toEqual({
        value: undefined,
        source: "environment",
      });
    });

    it("falls back to the environment variable when the admin value is removed", async () => {
      const setting = await EmailSetting.create({
        key: "host",
        value: "smtp.admin.example.com",
        updatedById: admin.id,
      });
      expect((await EmailSetting.resolve()).host.source).toEqual("admin");

      await setting.destroy();

      expect((await EmailSetting.resolve()).host).toEqual({
        value: "smtp.env.example.com",
        source: "environment",
      });
    });

    describe("with a stored value that fails validation", () => {
      /**
       * Stores a value directly in the database, skipping model validation, as
       * happens when a value was saved before the rules changed.
       *
       * @param key the name of the setting.
       * @param value the value to store.
       */
      async function storeWithoutValidation(key: string, value: unknown) {
        await sequelize.query(
          `INSERT INTO email_settings (id, key, value, "updatedById", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), :key, :value, :updatedById, now(), now())`,
          {
            replacements: {
              key,
              value: JSON.stringify(value),
              updatedById: admin.id,
            },
          }
        );
      }

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("ignores it and uses the environment variable", async () => {
        await storeWithoutValidation("port", 99999);
        await storeWithoutValidation("fromEmail", "leaked-secret-value");

        const settings = await EmailSetting.resolve();

        expect(settings.port).toEqual({ value: 2525, source: "environment" });
        expect(settings.fromEmail).toEqual({
          value: "env@example.com",
          source: "environment",
        });
      });

      it("logs a warning that does not include the value", async () => {
        const warn = vi.spyOn(Logger, "warn");
        await storeWithoutValidation("port", 99999);
        await storeWithoutValidation("fromEmail", "leaked-secret-value");

        await EmailSetting.resolve();

        expect(warn).toHaveBeenCalled();
        const logged = JSON.stringify(warn.mock.calls);
        expect(logged).not.toContain("99999");
        expect(logged).not.toContain("leaked-secret-value");
      });
    });

    describe("on an installation that has never saved a setting", () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("takes every value from the environment", async () => {
        expect(await EmailSetting.resolve()).toEqual({
          host: { value: "smtp.env.example.com", source: "environment" },
          port: { value: 2525, source: "environment" },
          fromEmail: { value: "env@example.com", source: "environment" },
        });
      });

      it("takes every value from the environment when none are set", async () => {
        env.SMTP_HOST = undefined;
        env.SMTP_PORT = undefined;
        env.SMTP_FROM_EMAIL = undefined;

        expect(await EmailSetting.resolve()).toEqual({
          host: { value: undefined, source: "environment" },
          port: { value: undefined, source: "environment" },
          fromEmail: { value: undefined, source: "environment" },
        });
      });

      it("does not save anything or log any warnings", async () => {
        const warn = vi.spyOn(Logger, "warn");

        await EmailSetting.resolve();

        expect(await EmailSetting.count()).toEqual(0);
        expect(warn).not.toHaveBeenCalled();
      });
    });
  });
});
