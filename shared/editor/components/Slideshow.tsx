import { ImageIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { sanitizeImageSrc } from "../../utils/urls";
import { toSlideshowAttrs } from "../lib/slideshow";
import type { ComponentProps } from "../types";

/** The duration of the crossfade between images, in milliseconds. */
const FADE_DURATION = 600;

/**
 * Renders a slideshow node, showing one image at a time and crossfading to
 * the next image after each interval, looping back to the first.
 *
 * @param props the component props.
 * @returns the slideshow element.
 */
export default function Slideshow({ node, isSelected }: ComponentProps) {
  const { t } = useTranslation();
  const { images, interval } = toSlideshowAttrs(node.attrs);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [failed, setFailed] = React.useState<ReadonlySet<number>>(new Set());
  const count = images.length;
  const imagesKey = images.join("\n");

  React.useEffect(() => {
    setActiveIndex(0);
    setFailed(new Set());

    if (count < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % count);
    }, interval);

    return () => window.clearInterval(timer);
  }, [count, interval, imagesKey]);

  const handleError = React.useCallback((index: number) => {
    setFailed((previous) => new Set(previous).add(index));
  }, []);

  const className = isSelected ? "ProseMirror-selectednode" : undefined;

  if (!count) {
    return (
      <Placeholder contentEditable={false} className={className}>
        <ImageIcon />
        {t("Empty slideshow")}
      </Placeholder>
    );
  }

  return (
    <Wrapper
      contentEditable={false}
      className={className}
      role="group"
      aria-roledescription={t("Slideshow")}
      aria-label={t("Image {{ current }} of {{ total }}", {
        current: activeIndex + 1,
        total: count,
      })}
    >
      {images.map((src, index) =>
        failed.has(index) ? (
          // Links to web pages rather than image files fail to load, show
          // why instead of collapsing to nothing.
          <FailedSlide
            key={`${index}-${src}`}
            aria-hidden={index !== activeIndex}
            $active={index === activeIndex}
            title={src}
          >
            <ImageIcon />
            {t("Couldn’t load image")}
          </FailedSlide>
        ) : (
          <Slide
            key={`${index}-${src}`}
            src={sanitizeImageSrc(src)}
            alt=""
            draggable={false}
            onError={() => handleError(index)}
            aria-hidden={index !== activeIndex}
            $active={index === activeIndex}
          />
        )
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: grid;
  max-width: 100%;
  margin: 0 auto;
  line-height: 0;
  border-radius: 8px;
  overflow: hidden;
  cursor: default;
  user-select: none;
`;

const Slide = styled.img<{ $active: boolean }>`
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  max-height: 75vh;
  object-fit: contain;
  opacity: ${(props) => (props.$active ? 1 : 0)};
  transition: opacity ${FADE_DURATION}ms ease-in-out;
`;

const Placeholder = styled.div`
  display: flex;
  line-height: normal;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  border: 1px dashed ${(props) => props.theme.divider};
  border-radius: 8px;
  color: ${(props) => props.theme.textTertiary};
  user-select: none;
`;

const FailedSlide = styled(Placeholder)<{ $active: boolean }>`
  grid-area: 1 / 1;
  opacity: ${(props) => (props.$active ? 1 : 0)};
  transition: opacity ${FADE_DURATION}ms ease-in-out;
`;
