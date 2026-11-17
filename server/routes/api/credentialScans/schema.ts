import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";

export const CredentialScansStartSchema = BaseSchema.extend({
  body: z.object({}),
});

export type CredentialScansStartReq = z.infer<
  typeof CredentialScansStartSchema
>;

export const CredentialScansInfoSchema = BaseSchema.extend({
  body: z.object({}),
});

export type CredentialScansInfoReq = z.infer<typeof CredentialScansInfoSchema>;
