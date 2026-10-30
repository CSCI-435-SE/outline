import * as React from "react";
import { AccessRequest, Document, User } from "@server/models";
import type { EmailProps } from "./BaseEmail";
import BaseEmail, { EmailMessageCategory } from "./BaseEmail";
import Body from "./components/Body";
import Button from "./components/Button";
import EmailTemplate from "./components/EmailLayout";
import Header from "./components/Header";
import Heading from "./components/Heading";

type InputProps = EmailProps & {
  documentId: string;
  actorId: string;
  accessRequestId: string;
  teamUrl: string;
};

type BeforeSend = {
  document: Document;
  actor: User;
  reason: string | null;
};

type Props = InputProps & BeforeSend;

/**
 * Email sent to users who can manage a document when someone requests access.
 */
export default class DocumentAccessRequestEmail extends BaseEmail<
  InputProps,
  BeforeSend
> {
  protected get category() {
    return EmailMessageCategory.Notification;
  }

  protected async beforeSend({
    documentId,
    actorId,
    accessRequestId,
  }: InputProps) {
    const document = await Document.unscoped().findByPk(documentId);
    if (!document) {
      return false;
    }

    const actor = await User.findByPk(actorId);
    if (!actor) {
      return false;
    }

    const accessRequest =
      await AccessRequest.unscoped().findByPk(accessRequestId);

    return { document, actor, reason: accessRequest?.reason ?? null };
  }

  protected subject({ actor, document }: Props) {
    return `${actor.name} is requesting access to "${document.titleWithDefault}"`;
  }

  protected preview({ actor }: Props): string {
    return `${actor.name} is requesting access to a document`;
  }

  protected fromName({ actor }: Props) {
    return actor.name;
  }

  protected renderAsText({ actor, teamUrl, document, reason }: Props): string {
    return `
${actor.name} is requesting access to "${document.titleWithDefault}".
${reason ? `\nReason: ${reason}\n` : ""}
Open the document to share it with them: ${teamUrl}${document.path}
`;
  }

  protected render(props: Props) {
    const { document, actor, teamUrl, reason } = props;
    const documentUrl = `${teamUrl}${document.path}?ref=notification-email&notifications=true`;

    return (
      <EmailTemplate
        previewText={this.preview(props)}
        goToAction={{ url: documentUrl, name: "View Document" }}
      >
        <Header />

        <Body>
          <Heading>{document.titleWithDefault}</Heading>
          <p>
            {actor.name} is requesting access to the{" "}
            <a href={documentUrl}>{document.titleWithDefault}</a> document.
          </p>
          {reason && (
            <p>
              <strong>Reason:</strong> {reason}
            </p>
          )}
          <p>Open the document to share it with them.</p>
          <p>
            <Button href={documentUrl}>View Document</Button>
          </p>
        </Body>
      </EmailTemplate>
    );
  }
}
