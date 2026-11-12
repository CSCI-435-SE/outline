import { BackIcon, NextIcon, PlusIcon, TrashIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../styles";
import { sanitizeImageSrc } from "../../utils/urls";

interface Props {
  /** The image URLs in the order they are shown. */
  images: readonly string[];
  /** The index of the image currently on screen. */
  currentIndex: number;
  /** Called to show an image in the slideshow. */
  onShow: (index: number) => void;
  /** Called to move an image to a new position. */
  onMove: (from: number, to: number) => void;
  /** Called to remove an image. */
  onRemove: (index: number) => void;
  /** Called to upload more images, if uploading is available. */
  onAdd?: () => void;
}

/**
 * Lists a slideshow's images as thumbnails with controls to reorder and
 * remove them and to add more. Shown below a selected slideshow to people who
 * can edit the document.
 *
 * @param props the component props.
 * @returns the image editor element.
 */
export function SlideshowImageEditor({
  images,
  currentIndex,
  onShow,
  onMove,
  onRemove,
  onAdd,
}: Props) {
  const { t } = useTranslation();
  const keys = React.useMemo(() => getStableKeys(images), [images]);
  const total = images.length;

  return (
    <Strip>
      <List aria-label={t("Slideshow images")}>
        {images.map((src, index) => {
          const position = { current: index + 1, total };
          return (
            <Item key={keys[index]} $current={index === currentIndex}>
              <Preview
                type="button"
                onClick={() => onShow(index)}
                aria-label={t(
                  "Preview image {{ current }} of {{ total }}",
                  position
                )}
                aria-pressed={index === currentIndex}
              >
                <img src={sanitizeImageSrc(src)} alt="" draggable={false} />
              </Preview>
              <Actions>
                <IconButton
                  type="button"
                  onClick={() => onMove(index, index - 1)}
                  disabled={index === 0}
                  aria-label={t("Move image {{ current }} earlier", position)}
                >
                  <BackIcon size={16} />
                </IconButton>
                <IconButton
                  type="button"
                  onClick={() => onMove(index, index + 1)}
                  disabled={index === total - 1}
                  aria-label={t("Move image {{ current }} later", position)}
                >
                  <NextIcon size={16} />
                </IconButton>
                <IconButton
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={t("Remove image {{ current }}", position)}
                  $danger
                >
                  <TrashIcon size={16} />
                </IconButton>
              </Actions>
            </Item>
          );
        })}
      </List>
      {onAdd && (
        <AddButton type="button" onClick={onAdd}>
          <PlusIcon size={20} />
          {t("Add images")}
        </AddButton>
      )}
    </Strip>
  );
}

/**
 * Gives each image a key that follows it when the list is reordered, so
 * keyboard focus stays on the same image after moving it. Repeated images
 * are told apart by how many times they appeared before.
 *
 * @param images the image URLs.
 * @returns a key for each image.
 */
function getStableKeys(images: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return images.map((src) => {
    const count = seen.get(src) ?? 0;
    seen.set(src, count + 1);
    return `${src}#${count}`;
  });
}

const Strip = styled.div`
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-top: 8px;
  padding: 8px;
  line-height: normal;
  border: 1px solid ${s("divider")};
  border-radius: 8px;
  overflow-x: auto;

  @media print {
    display: none;
  }
`;

const List = styled.ul`
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Item = styled.li<{ $current: boolean }>`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 96px;
  padding: 2px;
  border-radius: 6px;
  outline: 2px solid
    ${(props) => (props.$current ? props.theme.accent : "transparent")};
`;

const Preview = styled.button`
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  background: ${s("backgroundSecondary")};
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:focus-visible {
    outline: 2px solid ${s("accent")};
    outline-offset: 1px;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: center;
  gap: 2px;
`;

const IconButton = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: ${(props) =>
    props.$danger ? props.theme.danger : props.theme.textSecondary};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${s("backgroundSecondary")};
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid ${s("accent")};
  }
`;

const AddButton = styled.button`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 96px;
  padding: 8px;
  font-size: 13px;
  border: 1px dashed ${s("divider")};
  border-radius: 6px;
  background: none;
  color: ${s("textSecondary")};
  cursor: pointer;

  &:hover {
    color: ${s("text")};
    background: ${s("backgroundSecondary")};
  }

  &:focus-visible {
    outline: 2px solid ${s("accent")};
  }
`;
