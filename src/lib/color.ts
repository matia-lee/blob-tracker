export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Convert RGBA to a CSS rgba() string. */
export function toRGBAString(c: RGBA): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}
