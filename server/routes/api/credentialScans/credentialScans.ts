import Router from "koa-router";
import { UserRole } from "@shared/types";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import CredentialScanTask from "@server/queues/tasks/CredentialScanTask";
import type { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import {
  getCredentialScanReport,
  saveCredentialScanReport,
  type CredentialScanReport,
} from "@server/utils/credentialScanStore";
import * as T from "./schema";

const router = new Router();

// A "running" report older than this is assumed to be stuck, so a new scan may start.
const STALE_RUNNING_MS = 60 * 60 * 1000;

router.post(
  "credentialScans.start",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth({ role: UserRole.Admin }),
  validate(T.CredentialScansStartSchema),
  async (ctx: APIContext<T.CredentialScansStartReq>) => {
    const { user } = ctx.state.auth;

    const existing = await getCredentialScanReport(user.teamId);
    if (
      existing?.status === "running" &&
      Date.now() - Date.parse(existing.startedAt) < STALE_RUNNING_MS
    ) {
      ctx.body = { data: existing };
      return;
    }

    const report: CredentialScanReport = {
      status: "running",
      startedAt: new Date().toISOString(),
      documentsScanned: 0,
      results: [],
    };
    await saveCredentialScanReport(user.teamId, report);
    await new CredentialScanTask().schedule({
      teamId: user.teamId,
      startedAt: report.startedAt,
    });

    ctx.body = { data: report };
  }
);

router.post(
  "credentialScans.info",
  auth({ role: UserRole.Admin }),
  validate(T.CredentialScansInfoSchema),
  async (ctx: APIContext<T.CredentialScansInfoReq>) => {
    const { user } = ctx.state.auth;
    ctx.body = { data: (await getCredentialScanReport(user.teamId)) ?? null };
  }
);

export default router;
