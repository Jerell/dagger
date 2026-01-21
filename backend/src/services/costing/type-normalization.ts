/**
 * Type normalization for block types.
 * 
 * Users write natural language block types (e.g., "Capture Unit"),
 * but the cost library uses camelCase (e.g., "CaptureUnit").
 * This module handles the translation.
 */

/**
 * Normalize a user-friendly block type to cost library format.
 * 
 * @example
 * normalizeBlockType("Capture Unit") // → "CaptureUnit"
 * normalizeBlockType("capture unit") // → "CaptureUnit"
 * normalizeBlockType("CAPTURE_UNIT") // → "CaptureUnit"
 * normalizeBlockType("Pipe")         // → "Pipe" (already normalized)
 * normalizeBlockType("CaptureUnit")  // → "CaptureUnit" (already normalized)
 */
export function normalizeBlockType(userType: string): string {
  // First, check if it's already in PascalCase (no spaces, underscores, hyphens)
  // and has mixed case (not all uppercase or all lowercase)
  if (!/[\s_-]/.test(userType) && /[a-z]/.test(userType) && /[A-Z]/.test(userType)) {
    // Already appears to be PascalCase/camelCase, return as-is
    // Just ensure first letter is uppercase
    return userType.charAt(0).toUpperCase() + userType.slice(1);
  }
  
  // Split on spaces, underscores, or hyphens
  const words = userType.split(/[\s_-]+/);
  
  // Capitalize first letter of each word, lowercase the rest
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

/**
 * Known type mappings that don't follow the standard normalization pattern.
 * Add entries here for edge cases.
 */
const TYPE_OVERRIDES: Record<string, string> = {
  // Add any special cases here, e.g.:
  // "Source": "Emitter",  // if we use "Source" but cost library uses "Emitter"
};

/**
 * Normalize a block type with override support.
 * First checks for explicit overrides, then falls back to standard normalization.
 */
export function normalizeBlockTypeWithOverrides(userType: string): string {
  const trimmed = userType.trim();
  
  // Check for explicit override first
  if (TYPE_OVERRIDES[trimmed]) {
    return TYPE_OVERRIDES[trimmed];
  }
  
  // Check case-insensitive override
  const lowerKey = Object.keys(TYPE_OVERRIDES).find(
    key => key.toLowerCase() === trimmed.toLowerCase()
  );
  if (lowerKey) {
    return TYPE_OVERRIDES[lowerKey];
  }
  
  // Fall back to standard normalization
  return normalizeBlockType(trimmed);
}

/**
 * Denormalize a cost library type back to user-friendly format.
 * Converts camelCase to space-separated words.
 * 
 * @example
 * denormalizeBlockType("CaptureUnit") // → "Capture Unit"
 * denormalizeBlockType("Pipe")        // → "Pipe"
 */
export function denormalizeBlockType(costLibraryType: string): string {
  // Insert space before each uppercase letter (except the first)
  return costLibraryType.replace(/([A-Z])/g, " $1").trim();
}
