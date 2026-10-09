import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import { isSlideshowImageUrl, toSlideshowAttrs } from "../lib/slideshow";

/** Matches the opening line of a slideshow block, e.g. `:::slideshow 3000`. */
const OPEN_REGEX = /^:::slideshow(?:[ \t]+(\d+))?[ \t]*$/;

/** Matches the params of a `:::` container that is a slideshow. */
export const SLIDESHOW_PARAMS_REGEX = /^slideshow(\s|$)/;

/** Matches a markdown image on its own line, capturing the src. */
const IMAGE_REGEX = /^!\[[^\]]*\]\(\s*(\S+?)(?:\s+"[^"]*")?\s*\)$/;

/**
 * Returns the image source from a single line inside a slideshow block, which
 * may be a markdown image or a bare URL.
 *
 * @param line the line of markdown.
 * @returns the image source, or undefined if the line is not a usable image.
 */
function parseImageLine(line: string): string | undefined {
  const trimmed = line.trim();
  const src = trimmed.match(IMAGE_REGEX)?.[1] ?? trimmed;
  return src && isSlideshowImageUrl(src) ? src : undefined;
}

function slideshowBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
) {
  // Indented by four or more spaces is a code block.
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  const start = state.bMarks[startLine] + state.tShift[startLine];
  const match = state.src
    .slice(start, state.eMarks[startLine])
    .match(OPEN_REGEX);
  if (!match) {
    return false;
  }

  let nextLine = startLine;
  let closed = false;

  while (++nextLine < endLine) {
    const pos = state.bMarks[nextLine] + state.tShift[nextLine];
    const max = state.eMarks[nextLine];

    // A non-empty line with negative indent ends the enclosing block.
    if (pos < max && state.sCount[nextLine] < state.blkIndent) {
      break;
    }
    if (state.src.slice(pos, max).trim() === ":::") {
      closed = true;
      break;
    }
  }

  if (!closed) {
    return false;
  }
  if (silent) {
    return true;
  }

  const images = state
    .getLines(startLine + 1, nextLine, state.blkIndent, false)
    .split("\n")
    .map(parseImageLine)
    .filter((src): src is string => !!src);

  const token = state.push("slideshow", "div", 0);
  token.block = true;
  token.markup = ":::";
  token.info = match[1] ?? "";
  token.map = [startLine, nextLine + 1];
  token.meta = toSlideshowAttrs({ images, interval: match[1] });

  state.line = nextLine + 1;
  return true;
}

/**
 * A markdown-it plugin that parses slideshow blocks in the form:
 *
 * ```
 * :::slideshow 3000
 * ![](https://example.com/a.png)
 * ![](https://example.com/b.png)
 * :::
 * ```
 *
 * @param md the markdown-it instance.
 */
export default function slideshow(md: MarkdownIt) {
  md.block.ruler.before("fence", "slideshow", slideshowBlock, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
}
