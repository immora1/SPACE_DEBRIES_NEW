export function calculateTooltipPosition({
  mouseX,
  mouseY,
  containerRect,
  viewportWidth,
  viewportHeight,
  tooltipWidth,
  tooltipHeight,
  offset,
}) {
  let x = mouseX + offset
  let y = mouseY + offset

  if (containerRect.left + x + tooltipWidth > viewportWidth) {
    x = mouseX - tooltipWidth - offset
  }

  if (containerRect.left + x < 0) {
    x = -containerRect.left + offset
  }

  if (containerRect.top + y + tooltipHeight > viewportHeight) {
    y = mouseY - tooltipHeight - offset
  }

  if (containerRect.top + y < 0) {
    y = -containerRect.top + offset
  }

  return { x, y }
}
