import { readdir, readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PropertyMetadata {
  dimension?: string; // Dimension type (e.g., "pressure", "length", "temperature")
  defaultUnit?: string; // Default unit for display (e.g., "bar", "m", "C")
}

interface SchemaMetadata {
  block_type: string;
  version: string;
  required: string[];
  optional: string[];
  properties?: Record<string, PropertyMetadata>; // property name -> metadata
}

/**
 * Extract schema metadata from a Zod schema file
 * This is a simple parser that looks for z.object() definitions
 * and extracts required/optional properties
 */
async function extractSchemaMetadata(
  filePath: string,
  version: string
): Promise<SchemaMetadata | null> {
  const content = await readFile(filePath, "utf-8");

  // Extract block type from schema name (e.g., CompressorSchema -> Compressor)
  const blockTypeMatch = content.match(/export const (\w+)Schema/);
  if (!blockTypeMatch) {
    return null;
  }

  const schemaName = blockTypeMatch[1];
  const blockType = schemaName.replace("Schema", "");

  // Find z.object() definition - handle nested braces properly
  // Match from z.object({ to the closing }) accounting for nested objects
  let braceCount = 0;
  let objectStart = content.indexOf("z.object(");
  if (objectStart === -1) {
    return null;
  }

  // Find the opening brace
  objectStart = content.indexOf("{", objectStart);
  if (objectStart === -1) {
    return null;
  }

  let objectEnd = objectStart + 1;
  braceCount = 1;

  // Find matching closing brace
  while (braceCount > 0 && objectEnd < content.length) {
    if (content[objectEnd] === "{") braceCount++;
    if (content[objectEnd] === "}") braceCount--;
    objectEnd++;
  }

  if (braceCount !== 0) {
    return null;
  }

  const objectContent = content.substring(objectStart + 1, objectEnd - 1);
  const required: string[] = [];
  const optional: string[] = [];
  const properties: Record<string, PropertyMetadata> = {};

  // Parse properties - find property names by looking for "propName: z" patterns at top level
  // Use character-by-character parsing to accurately track depth and avoid matching inside meta() calls
  const matches: Array<{ name: string; index: number }> = [];
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let i = 0;

  while (i < objectContent.length) {
    const char = objectContent[i];
    const prevChar = i > 0 ? objectContent[i - 1] : null;

    // Handle strings
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && prevChar !== "\\") {
      inString = false;
      stringChar = null;
    }

    if (!inString) {
      if (char === "{" || char === "(") depth++;
      if (char === "}" || char === ")") depth--;

      // At top level (depth 0), look for property definitions
      // Only match if we're at a word boundary (start of word, not middle)
      if (
        depth === 0 &&
        char.match(/\w/) &&
        (i === 0 || !objectContent[i - 1].match(/\w/))
      ) {
        // Try to match: word : ... z .
        const remaining = objectContent.substring(i);
        const propMatch = remaining.match(/^(\w+)\s*:\s*[\s\S]{0,500}?z\s*\./);
        if (propMatch) {
          const propName = propMatch[1];
          // Verify the match doesn't span across a top-level comma (which would indicate multiple properties)
          const matchText = propMatch[0];
          let commaDepth = 0;
          let hasTopLevelComma = false;
          let inStr = false;
          let strChar = null;
          for (let k = 0; k < matchText.length; k++) {
            const c = matchText[k];
            const p = k > 0 ? matchText[k - 1] : null;
            if (!inStr && (c === '"' || c === "'")) {
              inStr = true;
              strChar = c;
            } else if (inStr && c === strChar && p !== "\\") {
              inStr = false;
              strChar = null;
            }
            if (!inStr) {
              if (c === "{" || c === "(") commaDepth++;
              if (c === "}" || c === ")") commaDepth--;
              if (c === "," && commaDepth === 0) {
                hasTopLevelComma = true;
                break;
              }
            }
          }

          // Only add if it's a real property (not type/quantity) and doesn't span multiple properties
          if (
            !hasTopLevelComma &&
            propName !== "type" &&
            propName !== "quantity"
          ) {
            matches.push({ name: propName, index: i });
            i += propMatch[0].length - 1; // Skip past this match
          }
        }
      }
    }

    i++;
  }

  // Now check each property to see if it's optional and extract unit metadata
  for (let i = 0; i < matches.length; i++) {
    const prop = matches[i];
    const propStart = prop.index;

    // Find the end of this property - need to find the comma at the top level
    // (not inside nested braces/parens)
    let propEnd =
      i < matches.length - 1 ? matches[i + 1].index : objectContent.length;
    const propSection = objectContent.substring(propStart, propEnd);

    // Find the comma that ends this property by tracking brace/paren depth
    let depth = 0;
    let inString = false;
    let stringChar = null;
    let lastComma = -1;

    for (let j = 0; j < propSection.length; j++) {
      const char = propSection[j];
      const prevChar = j > 0 ? propSection[j - 1] : null;

      // Handle strings
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== "\\") {
        inString = false;
        stringChar = null;
      }

      if (!inString) {
        if (char === "{" || char === "(") depth++;
        if (char === "}" || char === ")") depth--;
        if (char === "," && depth === 0) {
          lastComma = j;
          // Check if next non-whitespace is comment or looks like next property
          const after = propSection.substring(j + 1).trim();
          if (after.startsWith("//") || after.match(/^\w+\s*:/)) {
            break;
          }
        }
      }
    }

    if (lastComma !== -1) {
      propEnd = propStart + lastComma + 1;
    }

    const propDefinition = objectContent.substring(propStart, propEnd);

    // Check if optional - look for .optional() before the final comma/semicolon
    // Need to check if .optional() appears in the chain before any closing
    const isOptional = /\.optional\(\)/.test(propDefinition);
    if (isOptional) {
      optional.push(prop.name);
    } else {
      required.push(prop.name);
    }

    // Extract unit metadata from .meta({ unit: "...", defaultUnit: "..." })
    // Handle multi-line format with proper brace matching
    const metaStart = propDefinition.indexOf(".meta(");
    if (metaStart !== -1) {
      // Find the meta call content
      let metaBraceStart = propDefinition.indexOf("{", metaStart);
      if (metaBraceStart !== -1) {
        let metaBraceCount = 1;
        let metaBraceEnd = metaBraceStart + 1;
        while (metaBraceCount > 0 && metaBraceEnd < propDefinition.length) {
          if (propDefinition[metaBraceEnd] === "{") metaBraceCount++;
          if (propDefinition[metaBraceEnd] === "}") metaBraceCount--;
          metaBraceEnd++;
        }
        if (metaBraceCount === 0) {
          const metaContent = propDefinition.substring(
            metaBraceStart,
            metaBraceEnd
          );
          // Extract dimension and defaultUnit
          const dimensionMatch = metaContent.match(
            /dimension:\s*["']([^"']+)["']/
          );
          const defaultUnitMatch = metaContent.match(
            /defaultUnit:\s*["']([^"']+)["']/
          );

          if (dimensionMatch) {
            properties[prop.name] = {
              dimension: dimensionMatch[1],
            };
            if (defaultUnitMatch) {
              properties[prop.name].defaultUnit = defaultUnitMatch[1];
            }
          }
        }
      }
    }
  }

  const result: SchemaMetadata = {
    block_type: blockType,
    version,
    required,
    optional,
  };

  // Only include properties if there are any
  if (Object.keys(properties).length > 0) {
    result.properties = properties;
  }

  return result;
}

async function generateSchemas() {
  const schemasDir = join(__dirname);
  const versions = await readdir(schemasDir, { withFileTypes: true });

  for (const version of versions) {
    if (!version.isDirectory() || !version.name.startsWith("v")) {
      continue;
    }

    const versionDir = join(schemasDir, version.name);
    const files = await readdir(versionDir);

    for (const file of files) {
      if (!file.endsWith(".ts")) {
        continue;
      }

      const filePath = join(versionDir, file);
      const metadata = await extractSchemaMetadata(filePath, version.name);

      if (metadata) {
        const jsonPath = join(versionDir, file.replace(".ts", ".json"));
        await writeFile(jsonPath, JSON.stringify(metadata, null, 2));
        console.log(`Generated ${jsonPath}`);
      }
    }
  }
}

generateSchemas().catch(console.error);
