import { DoneIcon, ImageIcon, WarningIcon } from "outline-icons";
import { transparentize } from "polished";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { sanitizeImageSrc } from "../../utils/urls";
import { s } from "../../styles";
import type { SlideshowUploadItem } from "../lib/slideshow";
import { toSlideshowAttrs } from "../lib/slideshow";
import type { SlideshowUploadSession } from "../plugins/SlideshowUploadPlugin";
import { getSlideshowUploadSession } from "../plugins/SlideshowUploadPlugin";
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
export default function Slideshow({
  node,
  isSelected,
  isEditable,
  decorations,
}: ComponentProps) {
  const { t } = useTranslation();
  const { images, interval } = toSlideshowAttrs(node.attrs);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [failed, setFailed] = React.useState<ReadonlySet<number>>(new Set());
  const count = images.length;
  const imagesKey = images.join("\n");
  const session = getSlideshowUploadSession(decorations);

  React.useEffect(() => {
    setActiveIndex(0);
    setFailed(new Set());
  }, [imagesKey]);

  // Restarting the timer when the interval changes applies the new speed
  // straight away, without jumping back to the first image.
  React.useEffect(() => {
    if (count < 2 || session) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % count);
    }, interval);

    return () => window.clearInterval(timer);
  }, [count, interval, imagesKey, session]);

  const handleError = React.useCallback((index: number) => {
    setFailed((previous) => new Set(previous).add(index));
  }, []);

  const className = isSelected ? "ProseMirror-selectednode" : undefined;

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
