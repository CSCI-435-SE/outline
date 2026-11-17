import { Op } from "sequelize";
import { errToString } from "@shared/utils/error";
import { scanForCredentials } from "@shared/utils/credentialPatterns";
import Logger from "@server/logging/Logger";
import { Document } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import {
    saveCredentialScanReport,
    type CredentialScanResult,
} from "@server/utils/credentialScanStore";
import { BaseTask, TaskPriority } from "./base/BaseTask";

type Props = {
    teamId: string;
    startedAt: string;
};

const BATCH_SIZE = 100;

export default class CredentialScanTask extends BaseTask<Props> {
    public async perform({ teamId, startedAt }: Props) {
        const results: CredentialScanResult[] = [];
        let documentsScanned = 0;
        let lastId: string | undefined;

        for (; ;) {
            const documents = await Document.unscoped().findAll({
                attributes: ["id", "urlId", "title", "content", "text"],
                where: {
                    teamId,
                    ...(lastId ? { id: { [Op.gt]: lastId } } : {}),
                },
                order: [["id", "ASC"]],
                limit: BATCH_SIZE,
            });

            if (!documents.length) {
                break;
            }

            for (const document of documents) {
                try {
                    const body = DocumentHelper.toPlainText(document);
                    const matches = scanForCredentials(`${document.title}\n${body}`);
                    if (matches.length) {
                        results.push({
                            documentId: document.id,
                            urlId: document.urlId,
                            title: document.title,
                            path: Document.getPath({
                                title: document.title,
                                urlId: document.urlId,
                            }),
                            matches,
                        });
                    }
                } catch (err) {
                    Logger.warn("Credential scan skipped a document", {
                        documentId: document.id,
                        error: errToString(err),
                    });
                }
                documentsScanned += 1;
            }

            lastId = documents[documents.length - 1].id;
        }

        await saveCredentialScanReport(teamId, {
            status: "completed",
            startedAt,
            completedAt: new Date().toISOString(),
            documentsScanned,
            results,
        });
    }

    public async onFailed({ teamId, startedAt }: Props) {
        await saveCredentialScanReport(teamId, {
            status: "failed",
            startedAt,
            completedAt: new Date().toISOString(),
            documentsScanned: 0,
            results: [],
        });
    }

    public get options() {
        return {
            attempts: 1,
            priority: TaskPriority.Background,
        };
    }
}