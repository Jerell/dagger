// Unit formatting service for backend
// Applies unit preferences to query results

import dim from "./dim";

export interface UnitPreferences {
  queryOverrides?: Record<string, string>;
  blockTypes?: Record<string, Record<string, string>>;
  dimensions?: Record<string, string>;
  originalStrings?: Record<string, string>;
}

interface UnitMetadata {
  dimension?: string;
  defaultUnit?: string;
}

/**
 * Format a numeric value with unit preferences
 */
export async function formatValue(
  value: number,
  propertyName: string,
  blockType: string | undefined,
  unitPreferences: UnitPreferences,
  propertyMetadata?: UnitMetadata
): Promise<string> {
  // Determine preferred unit using precedence:
  // 1. Query parameter override
  // 2. Block-type preference in config
  // 3. Dimension-level preference in config
  // 4. Schema defaultUnit
  // 5. Base SI unit (no conversion)

  const preferredUnit =
    unitPreferences.queryOverrides?.[propertyName] ||
    (blockType && unitPreferences.blockTypes?.[blockType]?.[propertyName]) ||
    (propertyMetadata?.dimension &&
      unitPreferences.dimensions?.[propertyMetadata.dimension]) ||
    propertyMetadata?.defaultUnit;

  if (!preferredUnit) {
    // No preferred unit, return as number
    return value.toString();
  }

  // Get the base unit from the original string if available
  const originalKey = `_${propertyName}_original`;
  const originalString = unitPreferences.originalStrings?.[originalKey];

  if (!originalString) {
    // No original string, can't determine base unit - return as-is
    return value.toString();
  }

  try {
    const converted = dim.eval(`${originalString} as ${preferredUnit}`);
    return converted.trim();
  } catch (error) {
    // Conversion failed, return original value
    console.warn(
      `Failed to convert ${propertyName} to ${preferredUnit}:`,
      error
    );
    return value.toString();
  }
}

/**
 * Recursively format unit values in a query result object
 */
export async function formatQueryResult(
  result: any,
  unitPreferences: UnitPreferences,
  blockType?: string
): Promise<any> {
  if (result === null || result === undefined) {
    return result;
  }

  if (typeof result === "number") {
    // This is a numeric value - but we need context to format it
    // We can't format standalone numbers without property name
    return result;
  }

  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result)) {
    return Promise.all(
      result.map((item) => formatQueryResult(item, unitPreferences, blockType))
    );
  }

  if (typeof result === "object") {
    const formatted: any = {};
    const currentBlockType = result.type || blockType;

    for (const [key, value] of Object.entries(result)) {
      // Skip _property_original keys
      if (key.startsWith("_") && key.endsWith("_original")) {
        continue;
      }

      // Check if this is a numeric value that might need formatting
      if (typeof value === "number") {
        // Check if there's an original string for this property
        const originalKey = `_${key}_original`;
        if (result[originalKey]) {
          // This is a unit value - format it
          try {
            formatted[key] = await formatValue(
              value,
              key,
              currentBlockType,
              unitPreferences
            );
          } catch (error) {
            // Formatting failed, keep original value
            formatted[key] = value;
          }
        } else {
          // Not a unit value, keep as-is
          formatted[key] = value;
        }
      } else if (typeof value === "string") {
        // Check if this string looks like a unit value (e.g., "100 bar", "10 m")
        // WASM builds return original strings instead of normalized numbers
        const unitStringMatch = value.match(
          /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+(.+)$/
        );
        if (unitStringMatch) {
          const numericValue = parseFloat(unitStringMatch[1]);

          if (!isNaN(numericValue)) {
            // This looks like a unit string - try to format it
            try {
              // Store original string in preferences for this formatting
              const originalKey = `_${key}_original`;
              const formatPrefs = {
                ...unitPreferences,
                originalStrings: {
                  ...unitPreferences.originalStrings,
                  [originalKey]: value,
                },
              };

              formatted[key] = await formatValue(
                numericValue,
                key,
                currentBlockType,
                formatPrefs
              );
            } catch (error) {
              // Formatting failed, keep original string
              formatted[key] = value;
            }
          } else {
            // Not a valid number, keep as-is
            formatted[key] = value;
          }
        } else {
          // Not a unit string, keep as-is
          formatted[key] = value;
        }
      } else {
        // Recursively format nested objects/arrays
        formatted[key] = await formatQueryResult(
          value,
          unitPreferences,
          currentBlockType
        );
      }
    }

    return formatted;
  }

  return result;
}
