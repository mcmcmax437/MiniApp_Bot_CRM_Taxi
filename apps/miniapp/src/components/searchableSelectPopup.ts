export type SearchableSelectAnchorRect = Pick<DOMRect, "top" | "bottom" | "left" | "width">;

export type SearchableSelectPopupBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function calculateSearchableSelectPopupBox(
  rect: SearchableSelectAnchorRect,
  viewportHeight: number,
): SearchableSelectPopupBox {
  const gap = 8;
  const spaceBelow = viewportHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const openDown = spaceBelow >= 140 || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(120, Math.min(220, openDown ? spaceBelow : spaceAbove));

  return {
    top: openDown ? rect.bottom : Math.max(gap, rect.top - maxHeight),
    left: rect.left,
    width: rect.width,
    maxHeight,
  };
}
