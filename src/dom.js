export function sanitizedClone(element) {
  const copy = element.cloneNode(true);
  for (const child of copy.querySelectorAll("script, style, noscript")) {
    child.remove();
  }
  return copy;
}

export function normalizedText(element, maxLength) {
  return (sanitizedClone(element).textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizedHtml(element, maxLength) {
  return sanitizedClone(element).outerHTML.slice(0, maxLength);
}
