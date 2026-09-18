import { Schema } from "prosemirror-model";
import { getCommentCharacterCount } from "./getCommentCharacterCount";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
  },
});

const doc = (...children: object[]) =>
  schema.nodeFromJSON({ type: "doc", content: children });

const paragraph = (text?: string) => ({
  type: "paragraph",
  content: text ? [{ type: "text", text }] : [],
});

describe("getCommentCharacterCount", () => {
  it("is 0 for an empty document", () => {
    expect(getCommentCharacterCount(doc(paragraph()))).toBe(0);
  });

  it("is 0 for a document containing only whitespace", () => {
    expect(getCommentCharacterCount(doc(paragraph("   ")))).toBe(0);
  });

  it("equals the doc's nodeSize once there is real content", () => {
    const d = doc(paragraph("hello"));
    expect(getCommentCharacterCount(d)).toBe(d.nodeSize);
  });

  it("increases when a second paragraph is added", () => {
    const one = doc(paragraph("hello"));
    const two = doc(paragraph("hello"), paragraph("world"));
    expect(getCommentCharacterCount(two)).toBeGreaterThan(
      getCommentCharacterCount(one)
    );
  });
});
