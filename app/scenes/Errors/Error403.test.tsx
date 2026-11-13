import * as React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { ThemeProvider } from "styled-components";
import { light } from "@shared/styles/theme";
import { client } from "~/utils/ApiClient";
import { NotFoundError, RateLimitExceededError } from "~/utils/errors";
import Error403 from "./Error403";

const session = vi.hoisted(() => {
  const state: { user?: object } = {};
  return state;
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("~/hooks/useCurrentUser", () => ({ default: () => session.user }));
vi.mock("~/hooks/useStores", () => ({
  default: () => ({ dialogs: { openModal: vi.fn() } }),
}));
// With no action, Button renders a plain <button> and ignores the action
// context, so an empty context avoids wiring up the full provider.
vi.mock("~/actions/definitions/navigation", () => ({
  navigateToHome: undefined,
}));
vi.mock("~/hooks/useActionContext", () => ({ default: () => ({}) }));
vi.mock("~/components/RequestAccessDialog", () => ({ default: () => null }));
// Scene sets the page title from the team store, which isn't under test here.
vi.mock("~/components/Scene", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("~/scenes/Document/components/Loading", () => ({
  default: () => <div data-testid="loading" />,
}));

const documentId = "onboarding-abc123";

describe("Error403", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    session.user = {};
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    vi.clearAllMocks();
  });

  async function render() {
    await act(async () => {
      ReactDOM.render(
        <ThemeProvider theme={light}>
          <MemoryRouter>
            <Error403 documentId={documentId} />
          </MemoryRouter>
        </ThemeProvider>,
        container
      );
    });
  }

  /** The request access button, matched by either of its labels. */
  function requestButton() {
    return Array.from(container.querySelectorAll("button")).find((button) =>
      /Request access|Access requested/.test(button.textContent ?? "")
    );
  }

  it("checks for a pending request for the document", async () => {
    vi.mocked(client.post).mockRejectedValueOnce(new NotFoundError());

    await render();

    expect(client.post).toHaveBeenCalledWith("/accessRequests.info", {
      documentId,
    });
  });

  it("shows the request button without an error when there is no pending request", async () => {
    vi.mocked(client.post).mockRejectedValueOnce(
      new NotFoundError("Access request not found")
    );

    await render();

    expect(toast.error).not.toHaveBeenCalled();
    expect(requestButton()?.textContent).toEqual("Request access");
    expect(requestButton()?.disabled).toBe(false);
  });

  it("shows an error but keeps the button usable when the check fails", async () => {
    vi.mocked(client.post).mockRejectedValueOnce(
      new RateLimitExceededError("Too many requests, try again in a minute.")
    );

    await render();

    expect(toast.error).toHaveBeenCalledWith(
      "Too many requests, try again in a minute."
    );
    expect(requestButton()?.textContent).toEqual("Request access");
    expect(requestButton()?.disabled).toBe(false);
  });

  it("does not show an error if the page was left before the check failed", async () => {
    let failCheck: (err: Error) => void = () => {};
    vi.mocked(client.post).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        failCheck = reject;
      })
    );

    await render();
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    await act(async () => {
      failCheck(new RateLimitExceededError("Too many requests"));
    });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the request as sent when one is pending", async () => {
    vi.mocked(client.post).mockResolvedValueOnce({
      data: { status: "pending" },
    });

    await render();

    expect(toast.error).not.toHaveBeenCalled();
    expect(requestButton()?.textContent).toEqual("Access requested");
    expect(requestButton()?.disabled).toBe(true);
  });

  it("does not check, offer, or mention requesting access when logged out", async () => {
    session.user = undefined;

    await render();

    expect(client.post).not.toHaveBeenCalled();
    expect(requestButton()).toBeUndefined();
    expect(container.textContent).not.toContain("You can request access");
  });
});
