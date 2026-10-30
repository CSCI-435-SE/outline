import type { LocationDescriptor } from "history";
import { ClockIcon } from "outline-icons";
import * as React from "react";
import styled, { useTheme, css } from "styled-components";
import breakpoint from "styled-components-breakpoint";
import EventBoundary from "@shared/components/EventBoundary";
import { ellipsis, hover, s } from "@shared/styles";
import { isMobile } from "@shared/utils/browser";
import { STALE_DOCUMENT_THRESHOLD_DAYS } from "@shared/utils/isStale";
import { TeamPreference } from "@shared/types";
import NudeButton from "~/components/NudeButton";
import Tooltip from "~/components/Tooltip";
import { UnreadBadge } from "~/components/UnreadBadge";
import useClickIntent from "~/hooks/useClickIntent";
import useCurrentTeam from "~/hooks/useCurrentTeam";
import { undraggableOnDesktop } from "~/styles";
import Disclosure from "./Disclosure";
import type { Props as NavLinkProps } from "./NavLink";
import NavLink from "./NavLink";
import type { ActionWithChildren } from "~/types";
import { ContextMenu } from "~/components/Menu/ContextMenu";
import { useTranslation } from "react-i18next";

type Props = Omit<NavLinkProps, "to"> & {
  to?: LocationDescriptor;
  innerRef?: (ref: HTMLElement | null | undefined) => void;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  onClickIntent?: React.MouseEventHandler<HTMLElement>;
  onDisclosureClick?: React.MouseEventHandler<HTMLElement>;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  menu?: React.ReactNode;
  unreadBadge?: boolean;
  staleBadge?: boolean;
  $showActions?: boolean;
  disabled?: boolean;
  active?: boolean;
  expanded?: boolean;
  isActiveDrop?: boolean;
  isDraft?: boolean;
  depth?: number;
  ellipsis?: boolean;
  scrollIntoViewIfNeeded?: boolean;
  contextAction?: ActionWithChildren;
};

const activeDropStyle = {
  fontWeight: 600,
};

const stopPropagation = (ev: React.MouseEvent) => {
  ev.stopPropagation();
};

function SidebarLink(
  {
    icon,
    onClick,
    onClickIntent,
    to,
    label,
    active,
    isActiveDrop,
    isDraft,
    menu,
    $showActions,
    exact,
    href,
    depth,
    className,
    expanded,
    onDisclosureClick,
    disabled,
    unreadBadge,
    staleBadge,
    contextAction,
    ellipsis = true,
    ...rest
  }: Props,
  ref: React.RefObject<HTMLAnchorElement>
) {
  const hasDisclosure = expanded !== undefined;
  const { t } = useTranslation();
  const theme = useTheme();
  const team = useCurrentTeam({ rejectOnEmpty: false });
  const stalenessThreshold =
    (team?.getPreference(TeamPreference.StalenessThreshold) as
      | number
      | undefined) ?? STALE_DOCUMENT_THRESHOLD_DAYS;
  const { handleMouseEnter, handleMouseLeave } = useClickIntent(onClickIntent);
  const style = React.useMemo(
    () => ({
      paddingInlineStart: `${(depth || 0) * 16 + (icon ? -8 : 12)}px`,
      paddingInlineEnd: unreadBadge ? "32px" : undefined,
    }),
    [depth, icon, unreadBadge]
  );

  const unreadStyle = React.useMemo(
    () => ({
      insetInlineEnd: -20,
    }),
    []
  );

  const activeStyle = React.useMemo(
    () => ({
      color: theme.text,
      background: theme.sidebarActiveBackground,
      ...style,
    }),
    [theme.text, theme.sidebarActiveBackground, style]
  );

  const handleClick = React.useCallback(
    (ev: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick && !disabled && ev.isDefaultPrevented() === false) {
        onClick(ev);
      }
    },
    [onClick, disabled]
  );

  const handleDisclosureClick = React.useCallback(
    (ev: React.MouseEvent<HTMLElement>) => {
      if (!hasDisclosure) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      onDisclosureClick?.(ev);
    },
    [onDisclosureClick, hasDisclosure]
  );

  const DisclosureComponent = icon ? HiddenDisclosure : Disclosure;
  const staleLabel = t("Not edited in the last {{ days }} days", {
    days: stalenessThreshold,
  });
  const staleIndicator =
    staleBadge && !unreadBadge ? (
      <Tooltip content={staleLabel}>
        <StaleIndicator aria-label={staleLabel}>
          <ClockIcon size={18} />
        </StaleIndicator>
      </Tooltip>
    ) : null;

  const innerContent = (
    <>
      <ContextMenu action={contextAction} ariaLabel={t("Link options")}>
        <Content>
          {hasDisclosure && (
            <DisclosureComponent
              expanded={expanded}
              onClick={handleDisclosureClick}
              onMouseDown={stopPropagation}
              tabIndex={-1}
            />
          )}
          {icon && <IconWrapper aria-hidden>{icon}</IconWrapper>}
          <Label $ellipsis={ellipsis}>{label}</Label>
          {unreadBadge && <UnreadBadge style={unreadStyle} />}
          {staleIndicator}
        </Content>
      </ContextMenu>
      {menu && (
        <Actions $showActions={$showActions}>
          {staleIndicator}
          {menu}
        </Actions>
      )}
    </>
  );

  if (!to) {
    return (
      <Link
        as={href ? "a" : "button"}
        $isActiveDrop={isActiveDrop}
        $isDraft={isDraft}
        $disabled={disabled}
        style={active ? activeStyle : style}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragEnter={handleMouseEnter}
        href={href}
        className={className}
        ref={ref}
        {...rest}
      >
        {innerContent}
      </Link>
    );
  }

  return (
    <Link
      $isActiveDrop={isActiveDrop}
      $isDraft={isDraft}
      $disabled={disabled}
      style={active ? activeStyle : style}
      activeStyle={isActiveDrop ? activeDropStyle : activeStyle}
      onClick={handleClick}
      onActiveClick={handleDisclosureClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragEnter={handleMouseEnter}
      exact={exact !== false}
      to={to!}
      href={href}
      className={className}
      // @ts-expect-error spread props cause overload mismatch with styled NavLink
      ref={ref}
      {...rest}
    >
      {innerContent}
    </Link>
  );
}

export const IconWrapper = styled.span`
  margin-inline-start: -4px;
  height: 24px;
  overflow: hidden;
  flex-shrink: 0;
  transition: opacity 200ms ease-in-out;
`;

const StaleIndicator = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 24px;
  margin-inline-start: 4px;

  svg {
    fill: ${s("textTertiary")};
    opacity: 0.75;
  }
`;

const Content = styled.span`
  display: flex;
  align-items: start;
  position: relative;
  width: 100%;
  min-width: 0;
`;

const Actions = styled(EventBoundary)<{ $showActions?: boolean }>`
  display: inline-flex;
  visibility: ${(props) => (props.$showActions ? "visible" : "hidden")};
  position: absolute;
  top: 3px;
  inset-inline-end: 4px;
  gap: 4px;
  color: ${s("textTertiary")};
  transition: opacity 50ms;
  height: 24px;
  background: var(--background);

  svg {
    color: ${s("textSecondary")};
    fill: currentColor;
    opacity: 0.5;
  }

  &:hover {
    visibility: visible;

    svg {
      opacity: 0.75;
    }
  }
`;

const HiddenDisclosure = styled(Disclosure)`
  position: inherit;
  inset-inline-start: initial;
  display: none;
  margin-inline-start: -2px;
  margin-inline-end: 6px;
`;

const Link = styled(NavLink)<{
  $isActiveDrop?: boolean;
  $isDraft?: boolean;
  $disabled?: boolean;
}>`
  &:hover,
  &:active,
  &:has([data-state="open"]) {
    --background: ${s("sidebarHoverBackground")};
  }

  &[aria-current="page"] ${Actions} {
    --background: ${s("sidebarActiveBackground")};
  }

  ${(props) => props.$isActiveDrop && `--background: ${props.theme.slateDark};`}

  display: flex;
  position: relative;
  text-overflow: ellipsis;
  font-weight: 475;
  padding: ${isMobile() ? 12 : 6}px 16px;
  border-radius: 4px;
  min-height: 30px;
  user-select: none;
  white-space: nowrap;
  background: var(--background);
  color: ${(props) =>
    props.$isActiveDrop ? props.theme.white : props.theme.sidebarText};
  font-size: 16px;
  cursor: var(--pointer);
  overflow: hidden;
  border: 0;
  width: 100%;
  ${undraggableOnDesktop()}

  ${(props) =>
    props.$disabled &&
    css`
      pointer-events: none;
      opacity: 0.75;
    `}

  ${(props) =>
    props.$isDraft &&
    css`
      &:after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: 4px;
        border: 1.5px dashed ${props.theme.sidebarDraftBorder};
      }
    `}

  svg {
    ${(props) => (props.$isActiveDrop ? `fill: ${props.theme.white};` : "")}
    transition: fill 50ms;
  }

  &: ${hover},
  &:has([data-state="open"]) {
    ${HiddenDisclosure} {
      display: block;
    }
    ${HiddenDisclosure} + ${IconWrapper} {
      visibility: hidden;
      opacity: 0;
      width: 0;
    }
  }

  ${breakpoint("tablet")`
    padding-block: 3px;
    padding-inline: 12px 8px;
    font-size: 14px;
  `}

  @media (hover: hover) {
    &:hover ${Actions},
    &:active ${Actions},
    &:has([data-state="open"]) ${Actions} {
      visibility: visible;

      svg {
        opacity: 0.75;
      }
    }

    &:hover,
    &:has([data-state="open"]) {
      color: ${(props) =>
        props.$isActiveDrop ? props.theme.white : props.theme.text};
    }
  }

  & ${Actions} {
    ${NudeButton} {
      background: transparent;

      &:hover,
      &[aria-expanded="true"] {
        background: ${s("sidebarControlHoverBackground")};
      }
    }
  }
`;

const Label = styled.div<{ $ellipsis: boolean }>`
  position: relative;
  width: 100%;
  line-height: 24px;
  margin-inline-start: 2px;
  min-width: 0;
  text-align: start;

  ${(props) => props.$ellipsis && ellipsis()}

  * {
    unicode-bidi: plaintext;
  }
`;

export default React.forwardRef<HTMLAnchorElement, Props>(SidebarLink);