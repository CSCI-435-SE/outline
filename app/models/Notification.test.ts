import i18n from "i18next";
import { NotificationEventType } from "@shared/types";
import stores from "~/stores";
import Notification from "./Notification";

describe("Notification model", () => {
  describe("eventText", () => {
    it("names the detected credential types", () => {
      const notification = new Notification(
        {
          id: "1",
          event: NotificationEventType.CredentialDetected,
          data: { credentialTypes: ["AWS Access Key ID", "GitHub Token"] },
        },
        stores.notifications
      );

      expect(notification.eventText(i18n.t)).toBe(
        "saved a possible AWS Access Key ID, GitHub Token in"
      );
    });

    it("does not throw when credential types are missing", () => {
      const notification = new Notification(
        {
          id: "2",
          event: NotificationEventType.CredentialDetected,
          data: {},
        },
        stores.notifications
      );

      expect(() => notification.eventText(i18n.t)).not.toThrow();
    });
  });
});
