import type { Action as KbarAction } from "kbar";
import { vi } from "vitest";
import { actionToKBar } from "~/actions";
import { starDocument, unstarDocument } from "~/actions/definitions/documents";
import rootActions from "~/actions/root";
import stores from "~/stores";
import type { ActionContext, ActionVariant } from "~/types";

const SHORTCUT = "Control+Alt+KeyS";

function createContext(activeDocumentId: string | undefined) {
  return {
    isMenu: false,
    isCommandBar: true,
    isButton: false,
    activeDocumentId,
    stores,
    t: (key: string) => key,
  } as unknown as ActionContext;
}

// Our actions ignore kbar's ActionImpl argument, so perform is called without it.
function performKBarAction(action: KbarAction) {
  return (action.perform as (() => unknown) | undefined)?.();
}

function createDocument(
  id: string,
  { starred, canStar }: { starred: boolean; canStar: boolean }
) {
  const document = stores.documents.add({ id, title: "Test" });
  stores.policies.add({
    id,
    abilities: { star: canStar && !starred, unstar: canStar && starred },
  });
  if (starred) {
    stores.stars.add({ id: `star-${id}`, documentId: id });
  }
  return document;
}

describe("Star document keyboard shortcut", () => {
  afterEach(() => {
    stores.stars.clear();
    stores.policies.clear();
    stores.documents.clear();
    vi.restoreAllMocks();
  });

  test("star and unstar actions share the same shortcut", () => {
    expect(starDocument.shortcut).toEqual([SHORTCUT]);
    expect(unstarDocument.shortcut).toEqual([SHORTCUT]);
  });

  test("only the star action is registered when the document is not starred", () => {
    createDocument("doc-1", { starred: false, canStar: true });
    const context = createContext("doc-1");

    const star = actionToKBar(starDocument, context);
    const unstar = actionToKBar(unstarDocument, context);

    expect(star).toHaveLength(1);
    expect(star[0].shortcut).toEqual([SHORTCUT]);
    expect(unstar).toHaveLength(0);
  });

  test("only the unstar action is registered when the document is starred", () => {
    createDocument("doc-2", { starred: true, canStar: true });
    const context = createContext("doc-2");

    const star = actionToKBar(starDocument, context);
    const unstar = actionToKBar(unstarDocument, context);

    expect(star).toHaveLength(0);
    expect(unstar).toHaveLength(1);
    expect(unstar[0].shortcut).toEqual([SHORTCUT]);
  });

  test("shortcut is not registered when no document is active", () => {
    const context = createContext(undefined);

    expect(actionToKBar(starDocument, context)).toHaveLength(0);
    expect(actionToKBar(unstarDocument, context)).toHaveLength(0);
  });

  test("shortcut is not registered when the user cannot star the document", () => {
    createDocument("doc-3", { starred: false, canStar: false });
    const context = createContext("doc-3");

    expect(actionToKBar(starDocument, context)).toHaveLength(0);
    expect(actionToKBar(unstarDocument, context)).toHaveLength(0);
  });

  test("performing the shortcut stars an unstarred document", async () => {
    const document = createDocument("doc-4", {
      starred: false,
      canStar: true,
    });
    const spy = vi
      .spyOn(document, "star")
      .mockResolvedValue(undefined as never);
    const [action] = actionToKBar(starDocument, createContext("doc-4"));

    await performKBarAction(action);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("performing the shortcut unstars a starred document", async () => {
    const document = createDocument("doc-5", { starred: true, canStar: true });
    const spy = vi
      .spyOn(document, "unstar")
      .mockResolvedValue(undefined as never);
    const [action] = actionToKBar(unstarDocument, createContext("doc-5"));

    await performKBarAction(action);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("no other root action uses the same shortcut", () => {
    const collect = (actions: ActionVariant[]): ActionVariant[] =>
      actions.flatMap((action) =>
        action.variant === "action_with_children" &&
        Array.isArray(action.children)
          ? [action, ...collect(action.children as ActionVariant[])]
          : [action]
      );

    const conflicts = collect(rootActions).filter(
      (action) =>
        action.shortcut?.includes(SHORTCUT) &&
        action !== starDocument &&
        action !== unstarDocument
    );

    expect(conflicts).toEqual([]);
  });
});
