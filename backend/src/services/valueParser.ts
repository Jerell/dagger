/**
 * Shared utility for parsing and converting values
 *
 * Handles:
 * - Unit strings (e.g., "1 mi", "100 bar")
 * - Plain numeric strings (e.g., "0.7")
 * - Numbers
 *
 * Used by both validation (converting to numbers) and formatting (converting to preferred units)
 */

import dim from "./dim";

export type ValueParseResult = {
  /** The numeric value extracted */
  numericValue: number;
  /** The unit string if it was a unit string, undefined otherwise */
  unitString?: string;
  /** Whether this was a unit string */
  isUnitString: boolean;
};

/**
 * Parse a value to extract numeric value and unit information
 *
 * @param value - The value to parse (string or number)
 * @returns Parse result with numeric value and unit info, or undefined if parsing failed
 */
export function parseValue(
  value: string | number | null | undefined
): ValueParseResult | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  // If already a number, return it
  if (typeof value === "number") {
    return {
      numericValue: value,
      isUnitString: false,
    };
  }

  // If it's a string, try to parse it
  if (typeof value === "string") {
    // Check if it's a unit string (e.g., "1 mi", "100 bar", "12000000 Pa")
    const unitStringMatch = value.match(
      /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+(.+)$/
    );
    if (unitStringMatch) {
      // It's a unit string
      const numericValue = parseFloat(unitStringMatch[1]);
      if (!isNaN(numericValue)) {
        return {
          numericValue,
          unitString: value,
          isUnitString: true,
        };
      }
    } else {
      // Plain numeric string (e.g., "0.7")
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        return {
          numericValue,
          isUnitString: false,
        };
      }
    }
  }

  return undefined;
}

/**
 * Convert a value to a number in a target unit (for validation)
 *
 * @param value - The value to convert (string with unit, number, or plain string)
 * @param targetUnit - The target unit to convert to (e.g., "m", "bar")
 * @returns The numeric value in the target unit, or undefined if conversion failed
 */
export async function convertToNumber(
  value: string | number | null | undefined,
  targetUnit: string
): Promise<number | undefined> {
  const parsed = parseValue(value);
  if (!parsed) {
    return undefined;
  }

  // If it's already a number and no unit string, assume it's already in target unit
  if (!parsed.isUnitString) {
    return parsed.numericValue;
  }

  // Convert unit string to target unit
  try {
    const converted = dim.eval(`${parsed.unitString} as ${targetUnit}`);
    const numericValue = parseFloat(converted.split(" ")[0]);
    if (!isNaN(numericValue)) {
      return numericValue;
    }
  } catch (error) {
    // Conversion failed
    return undefined;
  }

  return undefined;
}
