import * as path from "path";

/**
 * Resolve a network identifier to an absolute path
 *
 * If the identifier is already an absolute path, use it as-is.
 * Otherwise, treat it as a preset name and resolve to networks/{name}
 *
 * @param networkIdentifier - Either a preset name (e.g., "preset1") or an absolute path
 * @returns Absolute path to the network directory
 */
export function resolveNetworkPath(
  networkIdentifier: string | undefined | null
): string {
  if (!networkIdentifier) {
    // Default to preset1 if not provided
    const defaultPath = path.resolve(process.cwd(), "networks/preset1");
    return path.normalize(defaultPath);
  }

  // Trim any whitespace or quotes that might have been added
  let trimmed = networkIdentifier.trim().replace(/^["']|["']$/g, "");

  // Decode URL encoding if present (e.g., %2F becomes /)
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    // If decoding fails, use the original value
  }

  // Check if it's an absolute path
  // On Unix systems, absolute paths start with /
  // On Windows, they start with a drive letter (C:\) or \\
  // We check both path.isAbsolute() and manually check for leading / on Unix
  // to handle edge cases where the path might have been modified or URL-encoded
  const isAbsolute =
    path.isAbsolute(trimmed) ||
    (process.platform !== "win32" &&
      trimmed.length > 0 &&
      trimmed.startsWith("/"));

  if (isAbsolute) {
    return path.normalize(trimmed);
  }

  // Otherwise, treat it as a preset name and resolve relative to backend/networks/
  const presetPath = path.resolve(process.cwd(), `networks/${trimmed}`);
  return path.normalize(presetPath);
}
