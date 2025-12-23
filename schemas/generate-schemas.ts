import { readdir, readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SchemaMetadata {
  block_type: string;
  version: string;
  required: string[];
  optional: string[];
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

  // Parse properties - look for property definitions
  // Required: propertyName: z.type()...
  // Optional: propertyName: z.type().optional()...
  // First, find all property matches
  const propertyRegex = /(\w+):\s*z\./g;
  const matches: Array<{ name: string; index: number }> = [];
  let match;

  while ((match = propertyRegex.exec(objectContent)) !== null) {
    const propName = match[1];
    // Skip 'type' and 'quantity' as they're always present
    if (propName !== "type" && propName !== "quantity") {
      matches.push({ name: propName, index: match.index! });
    }
  }

  // Now check each property to see if it's optional
  for (let i = 0; i < matches.length; i++) {
    const prop = matches[i];
    const propStart = prop.index;
    const propEnd =
      i < matches.length - 1 ? matches[i + 1].index : objectContent.length;

    const propDefinition = objectContent.substring(propStart, propEnd);

    if (propDefinition.includes(".optional()")) {
      optional.push(prop.name);
    } else {
      required.push(prop.name);
    }
  }

  return {
    block_type: blockType,
    version,
    required,
    optional,
  };
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
