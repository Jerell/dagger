/**
 * Unified value formatting service
 *
 * Handles formatting of values uniformly, whether they come from:
 * - Block properties
 * - Scope resolution (global, group, branch)
 * - Query results
 *
 * All values are formatted according to unit preferences with the same precedence.
 */

import { formatValue, UnitPreferences } from "./unitFormatter";
import { getBlockSchemaProperties } from "./effectSchemaProperties";

export interface FormatValueOptions {
  /** Property name (e.g., "length", "ambientTemperature") */
  propertyName: string;
  /** Block type (e.g., "Pipe", "Compressor") - optional for global properties */
  blockType?: string;
  /** Unit preferences from config */
  unitPreferences: UnitPreferences;
  /** Property metadata from schema (dimension, defaultUnit) - optional */
  propertyMetadata?: {
    dimension?: string;
    defaultUnit?: string;
  };
  /** Network path - used to look up schema metadata if not provided */
  networkPath?: string;
  /** Schema set version - used to look up schema metadata if not provided */
  schemaSet?: string;
  /** Block path - used to look up schema metadata if not provided */
  blockPath?: string;
}

/**
 * Format a single value according to unit preferences
 *
 * This is the unified entry point for formatting any value, whether it's:
 * - A unit string from WASM (e.g., "1 mi")
 * - A number
 * - A plain string
 *
 * Works uniformly for:
 * - Block properties (e.g., block.length)
 * - Global properties (e.g., ambientTemperature from config.toml)
 * - Scope-resolved properties (from branch, group, or global scope)
 *
 * @param value - The value to format (string with unit, number, or plain string)
 * @param options - Formatting options including property name, block type, unit preferences, etc.
 * @returns Formatted value string according to unit preferences
 */
export async function formatValueUnified(
  value: string | number | null | undefined,
  options: FormatValueOptions
): Promise<string | undefined> {
  if (value === null || value === undefined) {
    return undefined;
  }

  const {
    propertyName,
    blockType,
    unitPreferences,
    propertyMetadata: providedMetadata,
    networkPath,
    schemaSet,
    blockPath,
  } = options;

  // Try to get property metadata if not provided
  let propertyMetadata = providedMetadata;
  if (!propertyMetadata && networkPath && schemaSet && blockPath && blockType) {
    try {
      const schemaProperties = await getBlockSchemaProperties(
        networkPath,
        blockPath,
        schemaSet
      );
      const propertyKey = `${blockPath}/${propertyName}`;
      if (schemaProperties[propertyKey]) {
        const propInfo = schemaProperties[propertyKey];
        propertyMetadata = {
          dimension: propInfo.dimension,
          defaultUnit: propInfo.defaultUnit,
        };
      }
    } catch {
      // Schema lookup failed, continue without metadata
    }
  }

  // If no schema metadata, try config dimension map (for global properties)
  if (
    !propertyMetadata?.dimension &&
    unitPreferences.propertyDimensions?.[propertyName]
  ) {
    propertyMetadata = {
      dimension: unitPreferences.propertyDimensions[propertyName],
    };
  }

  // Handle different value types
  if (typeof value === "string") {
    // Check if it's a unit string (e.g., "1 mi", "100 bar")
    const unitStringMatch = value.match(
      /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+(.+)$/
    );

    if (unitStringMatch) {
      // This is a unit string - format it
      const numericValue = parseFloat(unitStringMatch[1]);
      if (isNaN(numericValue)) {
        return value; // Not a valid number, return as-is
      }

      // Store original string in preferences for formatValue
      const originalKey = `_${propertyName}_original`;
      const formatPrefs: UnitPreferences = {
        ...unitPreferences,
        originalStrings: {
          ...unitPreferences.originalStrings,
          [originalKey]: value,
        },
      };

      // Format with unit preferences
      return await formatValue(
        numericValue,
        propertyName,
        blockType,
        formatPrefs,
        propertyMetadata
      );
    } else {
      // Not a unit string, return as-is
      return value;
    }
  } else if (typeof value === "number") {
    // Numeric value - need original string for conversion
    // If we don't have it, we can't format it properly
    // Return as string representation
    const originalKey = `_${propertyName}_original`;
    const originalString = unitPreferences.originalStrings?.[originalKey];

    if (originalString) {
      // We have the original string, format it
      const formatPrefs: UnitPreferences = {
        ...unitPreferences,
        originalStrings: {
          ...unitPreferences.originalStrings,
          [originalKey]: originalString,
        },
      };
      return await formatValue(
        value,
        propertyName,
        blockType,
        formatPrefs,
        propertyMetadata
      );
    } else {
      // No original string, can't format - return number as string
      return value.toString();
    }
  }

  return String(value);
}
