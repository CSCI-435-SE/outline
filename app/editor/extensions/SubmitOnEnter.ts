import type { Command } from "prosemirror-state";
import Extension from "@shared/editor/lib/Extension";
import { isInCode } from "@shared/editor/queries/isInCode";

export default class SubmitOnEnter extends Extension {
  get name() {
    return "submitOnEnter";
  }

  keys(): Record<string, Command> {
    return {
      Enter: (state) => {
        if (isInCode(state) || !this.editor.props.onSave) {
          return false;
        }
        if (this.editor.isEmpty()) {
          return false;
        }

        this.editor.props.onSave({ done: true });
        return true;
      },
    };
  }
}
