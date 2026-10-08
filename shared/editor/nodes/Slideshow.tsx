import type Token from "markdown-it/lib/token.mjs";
import type {
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { sanitizeUrl } from "../../utils/urls";
import SlideshowComponent from "../components/Slideshow";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import { DEFAULT_SLIDESHOW_INTERVAL, toSlideshowAttrs } from "../lib/slideshow";
import slideshowRule from "../rules/slideshow";
import type { ComponentProps } from "../types";
import Node from "./Node";

/**
 * Escapes characters that would end a markdown link destination early.
 *
 * @param url the url to escape.
 * @returns the escaped url.
 */
const escapeUrl = (url: string) =>
  url.replace(/\s/g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

/**
 * A block that cycles through a list of images, crossfading between them.
 */
export default class Slideshow extends Node {
  get name() {
    return "slideshow";
  }

  get rulePlugins() {
    return [slideshowRule];
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        images: {
          default: [],
          validate: (value: unknown) => {
            if (
              !Array.isArray(value) ||
              !value.every((image) => typeof image === "string")
            ) {
              throw new RangeError("images must be an array of strings");
            }
          },
        },
        interval: {
          default: DEFAULT_SLIDESHOW_INTERVAL,
          validate: "number",
        },
      },
      group: "block",
      selectable: true,
      // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1289000
      draggable: false,
      defining: true,
      atom: true,
      parseDOM: [
        {
          tag: "div.slideshow",
          getAttrs: (dom: HTMLDivElement) =>
            toSlideshowAttrs({
              images: Array.from(dom.querySelectorAll("img")).map(
                (img) => img.getAttribute("src") ?? ""
              ),
              interval: dom.getAttribute("data-interval"),
            }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "slideshow",
          "data-interval": String(node.attrs.interval),
        },
        ...toSlideshowAttrs(node.attrs).images.map((src) => [
          "img",
          { src: sanitizeUrl(src), alt: "" },
        ]),
      ],
      leafText: (node) =>
        `(slideshow: ${toSlideshowAttrs(node.attrs).images.length} images)`,
    };
  }

  component = (props: ComponentProps) => <SlideshowComponent {...props} />;

  keys(): Record<string, Command> {
    return {
      // Pressing Enter with the slideshow selected creates a paragraph below.
      Enter: (state, dispatch) => {
        const { selection } = state;
        if (
          !(selection instanceof NodeSelection) ||
          selection.node.type.name !== this.name
        ) {
          return false;
        }

        if (dispatch) {
          const tr = state.tr.insert(
            selection.to,
            state.schema.nodes.paragraph.create()
          );
          dispatch(
            tr
              .setSelection(
                TextSelection.near(tr.doc.resolve(selection.to + 1))
              )
              .scrollIntoView()
          );
        }
        return true;
      },
    };
  }

  commands({ type }: { type: NodeType }) {
    return (attrs?: unknown): Command =>
      (state, dispatch) => {
        dispatch?.(
          state.tr
            .replaceSelectionWith(type.create(toSlideshowAttrs(attrs)))
            .scrollIntoView()
        );
        return true;
      };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    const { images, interval } = toSlideshowAttrs(node.attrs);

    // Block syntax would break out of a table cell, fall back to inline images.
    if (state.inTable) {
      state.write(images.map((src) => `![](${escapeUrl(src)})`).join(" "));
      return;
    }

    state.ensureNewLine();
    state.write(`:::slideshow ${interval}\n`);
    for (const src of images) {
      state.write(`![](${escapeUrl(src)})\n`);
    }
    state.write(":::");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "slideshow",
      getAttrs: (tok: Token) => toSlideshowAttrs(tok.meta),
    };
  }
}
