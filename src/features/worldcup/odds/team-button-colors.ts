/** Color palette used by an elevated team odds button. */
export type TeamButtonColors = { bg: string; text: string; shadow: string };

/** Neutral palette used by outcomes that do not represent a team. */
export const TEAM_BUTTON_NEUTRAL: TeamButtonColors = {
  bg: "#3f3f46",
  text: "#e4e4e7",
  shadow: darken("#3f3f46", 0.48),
};

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.slice(1);
  const full =
    value.length === 3 ? value.replace(/./g, (digit) => digit + digit) : value;
  const numeric = Number.parseInt(full, 16);
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
}

function relativeLuminance([red, green, blue]: [
  number,
  number,
  number,
]): number {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function readableText(rgb: [number, number, number]): string {
  const luminance = relativeLuminance(rgb);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return blackContrast >= whiteContrast ? "#0a0a0b" : "#ffffff";
}

function darken(hex: string, factor: number): string {
  const [red, green, blue] = hexToRgb(hex);
  return `rgb(${Math.round(red * factor)},${Math.round(green * factor)},${Math.round(blue * factor)})`;
}

/** Builds an accessible team palette from a three- or six-digit hex color. */
export function teamButtonColors(color?: string): TeamButtonColors | undefined {
  if (!color || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)) return undefined;
  const rgb = hexToRgb(color);
  return {
    bg: color,
    text: readableText(rgb),
    shadow: darken(color, 0.48),
  };
}
