/**
 * Typing a location's spot names in one go (the Locations tab's spot editor):
 * "A, B, C", one per line, or a range — "1-10", "A-F" — become the list of
 * values to declare on a level. Pure; the editor sends them one by one.
 */

/**
 * Separators between names: a comma or a new line. Splits "A, B" and
 * "A\nB"; leaves "A B" (a space) as one name.
 * https://regex101.com/?flavor=javascript&regex=%5B%2C%5Cn%5D&flags=g&testString=A%2C%20B%0AC
 */
const SEPARATORS = /[,\n]/;

/**
 * A number range, "1-10" or "1 – 10" (hyphen, en or em dash); not "A-1".
 * https://regex101.com/?flavor=javascript&regex=%5E%28%5Cd%2B%29%5Cs*%5B-%E2%80%93%E2%80%94%5D%5Cs*%28%5Cd%2B%29%24&testString=1-10%0A1%20%E2%80%93%2010%0AA-1
 */
const NUMBER_RANGE = /^(\d+)\s*[-–—]\s*(\d+)$/;

/**
 * A single-letter range, "A-F" (same case on both ends); not "AB-C".
 * https://regex101.com/?flavor=javascript&regex=%5E%28%5BA-Za-z%5D%29%5Cs*%5B-%E2%80%93%E2%80%94%5D%5Cs*%28%5BA-Za-z%5D%29%24&testString=A-F%0Aa-d%0AAB-C
 */
const LETTER_RANGE = /^([A-Za-z])\s*[-–—]\s*([A-Za-z])$/;

/** More than this from one range is almost surely a typo ("1-1000"). */
export const MAX_RANGE = 100;

function expand(piece: string): string[] {
  const numbers = NUMBER_RANGE.exec(piece);
  if (numbers) {
    const [from, to] = [Number(numbers[1]), Number(numbers[2])];
    const width = numbers[1].startsWith("0") ? numbers[1].length : 0;
    if (to < from || to - from + 1 > MAX_RANGE) return [piece];
    return Array.from({ length: to - from + 1 }, (_, i) => String(from + i).padStart(width, "0"));
  }
  const letters = LETTER_RANGE.exec(piece);
  if (letters) {
    const [from, to] = [letters[1].charCodeAt(0), letters[2].charCodeAt(0)];
    const sameCase = (letters[1] === letters[1].toUpperCase()) === (letters[2] === letters[2].toUpperCase());
    if (!sameCase || to < from) return [piece];
    return Array.from({ length: to - from + 1 }, (_, i) => String.fromCharCode(from + i));
  }
  return [piece];
}

/**
 * The names to add, in typed order, without blanks, repeats, or names the
 * level already has (case ignored, like the server).
 */
export function parsePlaceValues(input: string, existing: readonly string[] = []): string[] {
  const known = new Set(existing.map((v) => v.trim().toLowerCase()));
  const out: string[] = [];
  input
    .split(SEPARATORS)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .flatMap(expand)
    .forEach((value) => {
      const key = value.toLowerCase();
      if (known.has(key)) return;
      known.add(key);
      out.push(value);
    });
  return out;
}

/** Common level names offered as one-tap suggestions, biggest first. */
export const LEVEL_SUGGESTIONS = ["Zone", "Aisle", "Shelf", "Row", "Bin"] as const;
