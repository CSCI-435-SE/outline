import { TextSelection } from "prosemirror-state";
import { codeBlock, createEditorState, doc, p } from "@shared/test/editor";
import type { Editor } from "~/editor";
import SubmitOnEnter from "./SubmitOnEnter";

function createExtension({
  onSave,
  isEmpty = () => false,
}: {
  onSave?: ((options: { done: boolean }) => void) | null;
  isEmpty?: () => boolean;
} = {}) {
  const extension = new SubmitOnEnter();
  const resolvedOnSave = onSave === null ? undefined : (onSave ?? vi.fn());
  extension.editor = {
    props: { onSave: resolvedOnSave },
    isEmpty,
  } as unknown as Editor;

  return { extension, onSave: resolvedOnSave };
}

describe("SubmitOnEnter", () => {
  it("submits and prevents the default newline when Enter is pressed", () => {
    const { extension, onSave } = createExtension();
    const state = createEditorState(doc(p("Hello")));

    const handled = extension.keys().Enter(state, vi.fn());

    expect(handled).toBe(true);
    expect(onSave).toHaveBeenCalledWith({ done: true });
  });

  it("does not submit when the editor is empty", () => {
    const { extension, onSave } = createExtension({ isEmpty: () => true });
    const state = createEditorState(doc(p("")));

    const handled = extension.keys().Enter(state, vi.fn());

    expect(handled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not submit when the selection is inside a code block", () => {
    const { extension, onSave } = createExtension();
    let state = createEditorState(doc(codeBlock("const x = 1;")));
    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 2, 2))
    );

    const handled = extension.keys().Enter(state, vi.fn());

    expect(handled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does nothing when there is no onSave handler", () => {
    const { extension } = createExtension({ onSave: null });
    const state = createEditorState(doc(p("Hello")));

    const handled = extension.keys().Enter(state, vi.fn());

    expect(handled).toBe(false);
  });
});
