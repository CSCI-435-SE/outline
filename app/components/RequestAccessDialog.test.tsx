import * as React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import { toast } from "sonner";
import { client } from "~/utils/ApiClient";
import { BadRequestError, NotFoundError } from "~/utils/errors";
import RequestAccessDialog from "./RequestAccessDialog";

const dialog = vi.hoisted(() => {
  const state: { submit?: () => Promise<void | boolean> | void } = {};
  return state;
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Capture the submit handler; ConfirmationDialog's own behavior (closing the
// modal, showing errors as a toast) is not under test here.
vi.mock("~/components/ConfirmationDialog", () => ({
  default: ({
    onSubmit,
    children,
  }: {
    onSubmit: () => Promise<void | boolean> | void;
    children: React.ReactNode;
  }) => {
    dialog.submit = onSubmit;
    return <>{children}</>;
  },
}));
vi.mock("~/components/Input", () => ({ default: () => null }));

const documentId = "onboarding-abc123";
const duplicateError = new BadRequestError(
  "A pending access request already exists for this document and user."
);

describe("RequestAccessDialog", () => {
  let container: HTMLDivElement;
  let onRequested: () => void;

  beforeEach(() => {
    onRequested = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      ReactDOM.render(
        <RequestAccessDialog
          documentId={documentId}
          onRequested={onRequested}
        />,
        container
      );
    });
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    dialog.submit = undefined;
    vi.clearAllMocks();
  });

  it("sends the request and confirms it", async () => {
    vi.mocked(client.post).mockResolvedValueOnce({ data: {} });

    await dialog.submit?.();

    expect(client.post).toHaveBeenCalledWith("/accessRequests.create", {
      documentId,
      reason: undefined,
    });
    expect(onRequested).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Access request sent");
  });

  it("treats a request that is already pending as sent", async () => {
    vi.mocked(client.post)
      .mockRejectedValueOnce(duplicateError)
      .mockResolvedValueOnce({ data: { status: "pending" } });

    await dialog.submit?.();

    expect(client.post).toHaveBeenLastCalledWith("/accessRequests.info", {
      documentId,
    });
    expect(onRequested).toHaveBeenCalled();
  });

  it("reports the original error when no request is pending", async () => {
    vi.mocked(client.post)
      .mockRejectedValueOnce(duplicateError)
      .mockRejectedValueOnce(new NotFoundError());

    await expect(dialog.submit?.()).rejects.toBe(duplicateError);
    expect(onRequested).not.toHaveBeenCalled();
  });
});
