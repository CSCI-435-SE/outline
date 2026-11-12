import {
  BackIcon,
  DoneIcon,
  ImageIcon,
  NextIcon,
  WarningIcon,
} from "outline-icons";
import { hideVisually, transparentize } from "polished";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { sanitizeImageSrc } from "../../utils/urls";
import { s } from "../../styles";
import { updateSlideshowImages } from "../commands/updateSlideshowImages";
import { closeHistory } from "../lib/closeHistory";
import type { SlideshowUploadItem } from "../lib/slideshow";
import {
  getSlideshowIndexAfterChange,
  moveSlideshowImage,
  removeSlideshowImage,
  toSlideshowAttrs,
  wrapSlideshowIndex,
} from "../lib/slideshow";
import type { SlideshowUploadSession } from "../plugins/SlideshowUploadPlugin";
import { getSlideshowUploadSession } from "../plugins/SlideshowUploadPlugin";
import type { ComponentProps } from "../types";
import { SlideshowImageEditor } from "./SlideshowImageEditor";

/** The duration of the crossfade between images, in milliseconds. */
const FADE_DURATION = 600;

/** Matches when the reader has asked the OS to reduce motion. */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Renders a slideshow node, showing one image at a time and crossfading to
 * the next image after each interval, looping back to the first. Playback
 * pauses while the pointer is over the slideshow, while it has keyboard
 * focus, while it is scrolled out of view or the tab is hidden, and doesn't
 * auto-advance at all when the reader prefers reduced motion.
 *
 * @param props the component props.
 * @returns the slideshow element.
 */
export default function Slideshow({
  node,
  view,
  getPos,
  isSelected,
  isEditable,
  decorations,
  onAddImages,
}: Props) {
  const { t } = useTranslation();
  const { images, interval } = toSlideshowAttrs(node.attrs);
  const count = images.length;
  const imagesKey = images.join("\n");
  const session = getSlideshowUploadSession(decorations);
  const [wrapper, setWrapper] = React.useState<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(new Set());
  const [isHovered, setHovered] = React.useState(false);
  const [isFocused, setFocused] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const isPageVisible = usePageVisible();
  const isInView = useIsInView(wrapper);

  // Keep showing the same image when the list is edited, rather than jumping
  // back to the start or pointing at an image that no longer exists.
  const [previousImages, setPreviousImages] = React.useState(images);
  if (previousImages.join("\n") !== imagesKey) {
    setPreviousImages(images);
    setActiveIndex((index) =>
      getSlideshowIndexAfterChange(previousImages, images, index)
    );
  }
  const currentIndex = wrapSlideshowIndex(activeIndex, count);

  const isPlaying =
    count > 1 &&
    !session &&
    !reducedMotion &&
    !isHovered &&
    !isFocused &&
    isPageVisible &&
    isInView;

  // The timer restarts whenever the image changes, so stepping through the
  // images manually gives each one the full interval.
  React.useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((index) => wrapSlideshowIndex(index + 1, count));
    }, interval);

    return () => window.clearTimeout(timer);
  }, [isPlaying, currentIndex, count, interval]);

  const handleError = React.useCallback((src: string) => {
    setFailed((previous) => new Set(previous).add(src));
  }, []);

  const handlePrevious = React.useCallback(() => {
    setActiveIndex((index) => wrapSlideshowIndex(index - 1, count));
  }, [count]);

  const handleNext = React.useCallback(() => {
    setActiveIndex((index) => wrapSlideshowIndex(index + 1, count));
  }, [count]);

  const handlePointerEnter = React.useCallback(() => setHovered(true), []);
  const handlePointerLeave = React.useCallback(() => setHovered(false), []);
  const handleFocus = React.useCallback(() => setFocused(true), []);
  const handleBlur = React.useCallback((event: React.FocusEvent) => {
    // Moving focus between the controls keeps the slideshow paused.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocused(false);
    }
  }, []);

  // Each edit is its own undo step, even when made in quick succession.
  const handleUpdateImages = React.useCallback(
    (update: (images: string[]) => string[] | undefined) => {
      closeHistory(view);
      updateSlideshowImages(getPos(), update)(view.state, view.dispatch);
      closeHistory(view);
    },
    [view, getPos]
  );

  const handleMove = React.useCallback(
    (from: number, to: number) =>
      handleUpdateImages((list) => moveSlideshowImage(list, from, to)),
    [handleUpdateImages]
  );

  const handleRemove = React.useCallback(
    (index: number) =>
      handleUpdateImages((list) => removeSlideshowImage(list, index)),
    [handleUpdateImages]
  );

  const className = isSelected ? "ProseMirror-selectednode" : undefined;
  const imageEditor =
    isSelected && isEditable ? (
      <SlideshowImageEditor
        images={images}
        currentIndex={currentIndex}
        onShow={setActiveIndex}
        onMove={handleMove}
        onRemove={handleRemove}
        onAdd={onAddImages}
      />
    ) : null;

  if (session) {
    return (
      <UploadProgress
        session={session}
        className={className}
        canRecover={isEditable}
      />
    );
  }

  if (!count) {
    const placeholder = (
      <Placeholder contentEditable={false} className={className}>
        <ImageIcon />
        {t("Empty slideshow")}
      </Placeholder>
    );
    return imageEditor ? (
      <div contentEditable={false}>
        {placeholder}
        {imageEditor}
      </div>
    ) : (
      placeholder
    );
  }

  const position = t("Image {{ current }} of {{ total }}", {
    current: currentIndex + 1,
    total: count,
  });

  return (
    <Wrapper
      ref={setWrapper}
      contentEditable={false}
      className={className}
      role="group"
      aria-roledescription={t("Slideshow")}
      aria-label={t("Slideshow")}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <Stage>
        {images.map((src, index) =>
          failed.has(src) ? (
            // Links to web pages rather than image files fail to load, show
            // why instead of collapsing to nothing.
            <FailedSlide
              key={`${index}-${src}`}
              aria-hidden={index !== currentIndex}
              $active={index === currentIndex}
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
              onError={() => handleError(src)}
              aria-hidden={index !== currentIndex}
              $active={index === currentIndex}
            />
          )
        )}
        {count > 1 && (
          <>
            <Arrow
              type="button"
              $side="left"
              onClick={handlePrevious}
              aria-label={t("Previous image")}
            >
              <BackIcon />
            </Arrow>
            <Arrow
              type="button"
              $side="right"
              onClick={handleNext}
              aria-label={t("Next image")}
            >
              <NextIcon />
            </Arrow>
          </>
        )}
      </Stage>
      {/* Announce the image only when the reader changes it, not on every
          automatic advance. */}
      <LiveRegion aria-live={isPlaying ? "off" : "polite"} aria-atomic>
        {position}
      </LiveRegion>
      {count > 1 && (
        <Dots>
          {images.map((src, index) => (
            <Dot
              key={`${index}-${src}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={t("Show image {{ current }} of {{ total }}", {
                current: index + 1,
                total: count,
              })}
              aria-current={index === currentIndex ? "true" : undefined}
              $active={index === currentIndex}
            />
          ))}
        </Dots>
      )}
      {imageEditor}
    </Wrapper>
  );
}

interface Props extends ComponentProps {
  /** Opens a file picker to add images, if uploading is available. */
  onAddImages?: () => void;
}

/**
 * Tracks whether the reader has asked the OS to reduce motion.
 *
 * @returns true if reduced motion is preferred.
 */
function usePrefersReducedMotion(): boolean {
  const [matches, setMatches] = React.useState(
    () => getReducedMotionQuery()?.matches === true
  );

  React.useEffect(() => {
    const media = getReducedMotionQuery();
    if (!media || typeof media.addEventListener !== "function") {
      return;
    }
    const handleChange = () => setMatches(media.matches === true);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return matches;
}

function getReducedMotionQuery(): MediaQueryList | undefined {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : undefined;
}

/**
 * Tracks whether the browser tab is visible.
 *
 * @returns true unless the tab is hidden.
 */
function usePageVisible(): boolean {
  const [visible, setVisible] = React.useState(
    () => typeof document === "undefined" || !document.hidden
  );

  React.useEffect(() => {
    const handleChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleChange);
    return () => document.removeEventListener("visibilitychange", handleChange);
  }, []);

  return visible;
}

/**
 * Tracks whether an element is at least partly scrolled into view. Assumes
 * it is in view where IntersectionObserver isn't available.
 *
 * @param element the element to observe, or null before it mounts.
 * @returns true if the element is in view.
 */
function useIsInView(element: HTMLElement | null): boolean {
  const [inView, setInView] = React.useState(true);

  React.useEffect(() => {
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return inView;
}

interface UploadProgressProps {
  /** The uploads in progress for the slideshow. */
  session: SlideshowUploadSession;
  /** The class name applied to the wrapper. */
  className?: string;
  /** Whether failed uploads can be retried or removed. */
  canRecover: boolean;
}

/**
 * Shows each image being uploaded into a slideshow with its progress, and
 * lets failed uploads be retried or removed.
 *
 * @param props the component props.
 * @returns the upload progress element.
 */
function UploadProgress({
  session,
  className,
  canRecover,
}: UploadProgressProps) {
  const { t } = useTranslation();
  const { items } = session;
  const done = items.filter((item) => item.status === "done").length;
  const failed = items.filter((item) => item.status === "error").length;
  const uploading = items.length - done - failed;

  return (
    <UploadWrapper contentEditable={false} className={className}>
      <UploadStatus role="status">
        {uploading
          ? t("Uploading images… {{ done }} of {{ total }}", {
              done,
              total: items.length,
            })
          : t("{{ failed }} of {{ total }} images couldn’t be uploaded", {
              failed,
              total: items.length,
            })}
      </UploadStatus>
      <UploadGrid>
        {items.map((item) => (
          <UploadTile
            key={item.id}
            item={item}
            session={session}
            canRecover={canRecover}
          />
        ))}
      </UploadGrid>
    </UploadWrapper>
  );
}

interface UploadTileProps {
  /** The image being uploaded. */
  item: SlideshowUploadItem;
  /** The session the image belongs to. */
  session: SlideshowUploadSession;
  /** Whether a failed upload can be retried or removed. */
  canRecover: boolean;
}

function UploadTile({ item, session, canRecover }: UploadTileProps) {
  const { t } = useTranslation();
  const percent = Math.round(item.progress * 100);

  const handleRetry = React.useCallback(
    () => session.retry(item.id),
    [session, item.id]
  );
  const handleRemove = React.useCallback(
    () => session.dismiss(item.id),
    [session, item.id]
  );

  return (
    <Tile
      title={item.error ?? item.file.name}
      $failed={item.status === "error"}
    >
      {item.previewUrl ? (
        <TilePreview src={item.previewUrl} alt="" draggable={false} />
      ) : (
        <ImageIcon />
      )}
      {item.status === "uploading" && (
        <TileProgress
          role="progressbar"
          aria-label={t("Uploading {{ fileName }}", {
            fileName: item.file.name,
          })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <TileProgressFill style={{ width: `${percent}%` }} />
        </TileProgress>
      )}
      {item.status === "done" && (
        <TileBadge aria-label={t("Uploaded")}>
          <DoneIcon size={18} />
        </TileBadge>
      )}
      {item.status === "error" && (
        <TileError>
          <WarningIcon size={18} />
          <span>{t("Upload failed")}</span>
          {canRecover && (
            <TileActions>
              <TileButton
                type="button"
                onClick={handleRetry}
                aria-label={t("Retry uploading {{ fileName }}", {
                  fileName: item.file.name,
                })}
              >
                {t("Retry")}
              </TileButton>
              <TileButton
                type="button"
                onClick={handleRemove}
                aria-label={t("Remove {{ fileName }}", {
                  fileName: item.file.name,
                })}
              >
                {t("Remove")}
              </TileButton>
            </TileActions>
          )}
        </TileError>
      )}
    </Tile>
  );
}

const Wrapper = styled.div`
  max-width: 100%;
  margin: 0 auto;
  cursor: default;
  user-select: none;
`;

const Stage = styled.div`
  position: relative;
  display: grid;
  line-height: 0;
  border-radius: 8px;
  overflow: hidden;

  /* Printing (and saving as PDF) shows every image, stacked in order. */
  @media print {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: visible;
  }
`;

const Arrow = styled.button<{ $side: "left" | "right" }>`
  position: absolute;
  top: 50%;
  ${(props) => props.$side}: 8px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: ${(props) => transparentize(0.2, props.theme.background)};
  color: ${s("text")};
  cursor: pointer;
  opacity: 0;
  transition: opacity 150ms ease-in-out;

  ${Stage}:hover &,
  &:focus-visible {
    opacity: 1;
  }

  /* Touch screens have no hover, keep the controls visible. */
  @media (hover: none) {
    opacity: 1;
  }

  @media print {
    display: none;
  }
`;

const LiveRegion = styled.div`
  ${hideVisually()}
`;

const Dots = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding-top: 8px;

  @media print {
    display: none;
  }
`;

const Dot = styled.button<{ $active: boolean }>`
  /* A larger hit area around a small visible dot. */
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;

  &::after {
    content: "";
    display: block;
    width: 8px;
    height: 8px;
    margin: auto;
    border-radius: 50%;
    background: ${(props) =>
      props.$active ? props.theme.text : props.theme.textTertiary};
    opacity: ${(props) => (props.$active ? 1 : 0.5)};
  }

  &:focus-visible {
    outline: 2px solid ${s("accent")};
    outline-offset: -2px;
    border-radius: 50%;
  }
`;

const Slide = styled.img<{ $active: boolean }>`
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  max-height: 75vh;
  object-fit: contain;
  opacity: ${(props) => (props.$active ? 1 : 0)};
  transition: opacity ${FADE_DURATION}ms ease-in-out;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media print {
    opacity: 1;
    transition: none;
  }
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

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media print {
    opacity: 1;
    transition: none;
  }
`;

const UploadWrapper = styled.div`
  line-height: normal;
  padding: 12px;
  border: 1px dashed ${(props) => props.theme.divider};
  border-radius: 8px;
  cursor: default;
  user-select: none;
`;

const UploadStatus = styled.div`
  font-size: 14px;
  color: ${s("textSecondary")};
  margin-bottom: 8px;
`;

const UploadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
`;

const Tile = styled.div<{ $failed: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  overflow: hidden;
  background: ${s("backgroundSecondary")};
  color: ${s("textTertiary")};
  outline: ${(props) =>
    props.$failed ? `1px solid ${props.theme.danger}` : "none"};
`;

const TilePreview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TileProgress = styled.div`
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const TileProgressFill = styled.div`
  height: 100%;
  background: ${s("accent")};
  transition: width 150ms ease-out;
`;

const TileBadge = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  border-radius: 50%;
  background: ${s("accent")};
  color: ${s("accentText")};
`;

const TileError = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  font-size: 13px;
  text-align: center;
  background: ${(props) => transparentize(0.1, props.theme.background)};
  color: ${s("danger")};
`;

const TileActions = styled.div`
  display: flex;
  gap: 4px;
`;

const TileButton = styled.button`
  padding: 2px 8px;
  font-size: 13px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  cursor: pointer;

  &:hover {
    background: ${s("backgroundSecondary")};
  }
`;
