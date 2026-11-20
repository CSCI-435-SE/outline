import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import { isMailboxAddress } from "@server/utils/validators";
import User from "./User";
import IdModel from "./base/IdModel";
import Fix from "./decorators/Fix";

/**
 * An email setting saved by an admin. Settings are installation-wide, and a
 * saved value takes precedence over the matching environment variable.
 */
@Table({
  tableName: "email_settings",
  modelName: "email_setting",
  validate: {
    isValidForKey(this: EmailSetting) {
      if (!isValidEmailSettingValue(this.key, this.value)) {
        throw new Error(`Invalid value for email setting "${this.key}"`);
      }
    },
  },
})
@Fix
export class EmailSetting extends IdModel<
  InferAttributes<EmailSetting>,
  Partial<InferCreationAttributes<EmailSetting>>
> {
  /**
   * Works out the effective value of every email setting. An admin value wins
   * over the environment variable, and each value reports where it came from.
   *
   * @returns the effective value and source of each setting.
   */
  public static async resolve(): Promise<ResolvedEmailSettings> {
    const stored = new Map(
      (await this.findAll()).map((setting) => [setting.key, setting.value])
    );
    const fromEnvironment = environmentValues();

    const resolveKey = (key: EmailSettingKey): ResolvedEmailSetting => {
      const value = stored.get(key);
      if (value === undefined) {
        return { value: fromEnvironment[key], source: "environment" };
      }
      if (!isValidEmailSettingValue(key, value)) {
        // The value is deliberately not logged, it may be sensitive.
        Logger.warn(
          `Ignoring invalid stored email setting "${key}", using the environment value instead`
        );
        return { value: fromEnvironment[key], source: "environment" };
      }
      return { value, source: "admin" };
    };

    return {
      host: resolveKey("host"),
      port: resolveKey("port"),
      fromEmail: resolveKey("fromEmail"),
    };
  }

  /** The name of the setting, for example "host". */
  @Column(DataType.STRING)
  key: EmailSettingKey;

  /** The saved value of the setting. */
  @Column(DataType.JSONB)
  value: string | number;

  // associations

  /** The user who last changed the setting. */
  @BelongsTo(() => User, "updatedById")
  updatedBy: User | null;

  /** The ID of the user who last changed the setting; updatedAt records when. */
  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  updatedById: string | null;
}

/** The email settings that an admin can save. */
export type EmailSettingKey = "host" | "port" | "fromEmail";

/** Where the effective value of an email setting came from. */
export type EmailSettingSource = "admin" | "environment";

/** The effective value of an email setting and where it came from. */
export interface ResolvedEmailSetting {
  /** The effective value, or undefined if neither source sets it. */
  value: string | number | undefined;
  /** Whether the value came from an admin or the environment. */
  source: EmailSettingSource;
}

/** The effective value of every email setting. */
export type ResolvedEmailSettings = Record<
  EmailSettingKey,
  ResolvedEmailSetting
>;

/**
 * Reads the environment variable behind each email setting. Read on every call
 * so that the current environment is always used.
 *
 * @returns the environment value of each setting.
 */
function environmentValues(): Record<
  EmailSettingKey,
  string | number | undefined
> {
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    fromEmail: env.SMTP_FROM_EMAIL,
  };
}

/**
 * Checks whether a value is acceptable for the given email setting.
 *
 * @param key the name of the setting.
 * @param value the value to check.
 * @returns true if the value can be saved, false otherwise.
 */
function isValidEmailSettingValue(key: EmailSettingKey, value: unknown) {
  switch (key) {
    case "host":
      return typeof value === "string" && value.trim() !== "";
    case "port":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 65535
      );
    case "fromEmail":
      return typeof value === "string" && isMailboxAddress(value);
    default:
      return false;
  }
}
