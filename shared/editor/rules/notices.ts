import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import customFence from "markdown-it-container";
import { SLIDESHOW_PARAMS_REGEX } from "./slideshow";

export default function notice(md: MarkdownIt): void {
  return customFence(md, "notice", {
    marker: ":",
    // Slideshows share the ::: marker but are parsed by their own rule.
    validate: (params: string) => !SLIDESHOW_PARAMS_REGEX.test(params.trim()),
    render(tokens: Token[], idx: number) {
      const { info } = tokens[idx];

      if (tokens[idx].nesting === 1) {
        // opening tag
        return `<div class="notice notice-${md.utils.escapeHtml(info)}">\n`;
      } else {
        // closing tag
        return "</div>\n";
      }
    },
  });
}
