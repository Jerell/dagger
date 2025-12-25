// Unit formatting service for backend
// Applies unit preferences to query results

import dim from "./dim";

export interface UnitPreferences {
  queryOverrides?: Record<string, string>;
  blockTypes?: Record<string, Record<string, string>>;
  dimensions?: Record<string, string>;
  originalStrings?: Record<string, string>;
  propertyDimensions?: Record<string, string>; // Maps property names to dimensions
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

  // Get the original string if available
  const originalKey = `_${propertyName}_original`;
  const originalString = unitPreferences.originalStrings?.[originalKey];

  if (!preferredUnit) {
    // No preferred unit - return original string if available, otherwise just the number
    return originalString || value.toString();
  }

  if (!originalString) {
    // No original string, can't determine base unit - return as-is
    // But if we have the result as a string, return that instead
    return value.toString();
  }

  try {
    const converted = dim.eval(`${originalString} as ${preferredUnit}`);
    return converted.trim();
  } catch (error) {
    // Conversion failed, return original value
    console.warn(
      `Failed to convert ${propertyName} from ${originalString} to ${preferredUnit}:`,
      error
    );
    // Return original string instead of just the number
    return originalString;
  }
}

/**
 * Recursively format unit values in a query result object
 */
export async function formatQueryResult(
  result: any,
  unitPreferences: UnitPreferences,
  blockType?: string,
  propertyName?: string,
  propertyMetadata?: UnitMetadata
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
    // Check if this is a top-level unit string (from scope resolution)
    // and we have property context to format it the same way as block properties
    if (propertyName) {
      // Check if it looks like a unit string (has space separating number and unit)
      const unitStringMatch = result.match(
        /^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+(.+)$/
      );
      if (unitStringMatch) {
        // This looks like a unit string - format it using the same logic as block properties
        try {
          // Store original string in preferences (same as block properties)
          const originalKey = `_${propertyName}_original`;
          const formatPrefs = {
            ...unitPreferences,
            originalStrings: {
              ...unitPreferences.originalStrings,
              [originalKey]: result,
            },
          };

          // Extract numeric value (formatValue uses originalString for conversion, but needs number as fallback)
          const numericValue = parseFloat(unitStringMatch[1]);

          // Use formatValue with property metadata (same as block properties)
          return await formatValue(
            numericValue,
            propertyName,
            blockType,
            formatPrefs,
            propertyMetadata
          );
        } catch (error) {
          // Formatting failed, keep original string
          return result;
        }
      }
    }
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
