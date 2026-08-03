export type AnchoredPortalMenuRect = Pick<DOMRectReadOnly, "top" | "bottom" | "right">;

export type AnchoredPortalMenuStyle = {
  position: "fixed";
  zIndex: number;
  right: number;
  maxHeight: number;
  overflowY: "auto";
  visibility: "visible";
  top: number | "auto";
  bottom: number | "auto";
};

export function getAnchoredPortalMenuStyle(input: {
  anchorRect: AnchoredPortalMenuRect;
  viewportWidth: number;
  viewportHeight: number;
  menuHeight?: number;
  gap?: number;
  pad?: number;
}): AnchoredPortalMenuStyle {
  const gap = input.gap ?? 8;
  const pad = input.pad ?? 10;
  const menuHeight = input.menuHeight ?? 280;
  const spaceBelow = input.viewportHeight - input.anchorRect.bottom - gap - pad;
  const spaceAbove = input.anchorRect.top - gap - pad;
  const openUp = spaceBelow < Math.min(220, menuHeight) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    140,
    Math.min(input.viewportHeight * 0.7, 420, openUp ? spaceAbove : spaceBelow),
  );
  const right = Math.max(pad, input.viewportWidth - input.anchorRect.right);

  return {
    position: "fixed",
    zIndex: 1200,
    right,
    maxHeight,
    overflowY: "auto",
    visibility: "visible",
    ...(openUp
      ? { bottom: input.viewportHeight - input.anchorRect.top + gap, top: "auto" as const }
      : { top: input.anchorRect.bottom + gap, bottom: "auto" as const }),
  };
}
