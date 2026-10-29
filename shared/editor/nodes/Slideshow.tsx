import { t } from "i18next";
import type Token from "markdown-it/lib/token.mjs";
import { ClockIcon } from "outline-icons";
import type {
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { NodeSelection, TextSelection } from "prosemirror-state";
import { getEventFiles } from "../../utils/files";
import { sanitizeUrl } from "../../utils/urls";
import { AttachmentValidation } from "../../validations";
import insertSlideshowFiles from "../commands/insertSlideshowFiles";
import SlideshowComponent from "../components/Slideshow";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import {
  DEFAULT_SLIDESHOW_INTERVAL,
  SLIDESHOW_INTERVALS,
  formatSlideshowInterval,
  toSlideshowAttrs,
} from "../lib/slideshow";
import { SlideshowUploadPlugin } from "../plugins/SlideshowUploadPlugin";
import slideshowRule from "../rules/slideshow";
import type {
  ComponentProps,
  MenuItem,
  SelectionToolbarMenuDescriptor,
} from "../types";
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

  get plugins() {
    return [new SlideshowUploadPlugin()];
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
    return {
      slideshow:
        (attrs?: unknown): Command =>
        (state, dispatch) => {
          dispatch?.(
            state.tr
              .replaceSelectionWith(type.create(toSlideshowAttrs(attrs)))
              .scrollIntoView()
          );
          return true;
        },
      // Opens a file picker and uploads the chosen images into a new slideshow.
      uploadSlideshow: (): Command => () => {
        const {
          uploadFile,
          onFileUploadStart,
          onFileUploadStop,
          onFileUploadProgress,
        } = this.editor.props;
        if (!uploadFile) {
          return false;
        }

        const inputElement = document.createElement("input");
        inputElement.type = "file";
        inputElement.multiple = true;
        inputElement.accept = AttachmentValidation.imageContentTypes.join(", ");
        inputElement.onchange = (event) => {
          insertSlideshowFiles(this.editor.view, getEventFiles(event), {
            uploadFile,
            onFileUploadStart,
            onFileUploadStop,
            onFileUploadProgress,
          });
        };
        inputElement.click();
        return true;
      },
      // Sets how long each image of the selected slideshow is shown for.
      slideshowInterval:
        (attrs?: unknown): Command =>
        (state, dispatch) => {
          const { selection } = state;
          if (
            !(selection instanceof NodeSelection) ||
            selection.node.type !== type
          ) {
            return false;
          }

          const { interval } = toSlideshowAttrs(attrs);
          const tr = state.tr.setNodeAttribute(
            selection.from,
            "interval",
            interval
          );
          dispatch?.(
            tr.setSelection(NodeSelection.create(tr.doc, selection.from))
          );
          return true;
        },
    };
  }

  selectionToolbarMenus(): SelectionToolbarMenuDescriptor[] {
    return [
      {
        priority: 50,
        matches: (ctx) => ctx.selectedNodeType === this.name && !ctx.readOnly,
        getItems: (ctx) => {
          const { selection } = ctx.state;
          const current =
            selection instanceof NodeSelection
              ? toSlideshowAttrs(selection.node.attrs).interval
              : DEFAULT_SLIDESHOW_INTERVAL;

          const items: MenuItem[] = [
            {
              name: "slideshowInterval",
              tooltip: t("Transition speed"),
              label: formatSlideshowInterval(current),
              icon: <ClockIcon />,
              children: SLIDESHOW_INTERVALS.map((interval) => ({
                name: "slideshowInterval",
                label: formatSlideshowInterval(interval),
                attrs: { interval },
                active: () => interval === current,
              })),
            },
          ];
          return items;
        },
      },
    ];
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
