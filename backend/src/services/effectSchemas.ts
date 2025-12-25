import { Schema } from "effect";
import { schemaRegistry } from "../schemas/index.js";

export interface PropertyMetadata {
  dimension?: string;
  defaultUnit?: string;
  title?: string;
  min?: number;
  max?: number;
}

export interface SchemaMetadata {
  blockType: string;
  schemaSet: string;
  required: string[];
  optional: string[];
  properties: Record<string, PropertyMetadata>;
}

/**
 * Get a schema from the registry
 */
export function getSchema(
  schemaSet: string,
  blockType: string
): Schema.Schema<any> | undefined {
  const registry = schemaRegistry as Record<
    string,
    Record<string, Schema.Schema<any>>
  >;
  return registry[schemaSet]?.[blockType];
}

/**
 * List all available schema sets
 */
export function listSchemaSets(): string[] {
  return Object.keys(schemaRegistry);
}

/**
 * List all block types for a given schema set
 */
export function listBlockTypes(schemaSet: string): string[] {
  const registry = schemaRegistry as Record<
    string,
    Record<string, Schema.Schema<any>>
  >;
  return Object.keys(registry[schemaSet] || {});
}

/**
 * Extract annotations from a schema
 */
function getAnnotations(schema: Schema.Schema<any>): Record<string, any> {
  try {
    // Effect Schema stores annotations in the schema's internal structure
    // We can access them via the AST or annotations method
    const ast = Schema.ast(schema);
    if (ast && "_tag" in ast && ast._tag === "Refinement") {
      // For refined schemas, get annotations from the from schema
      const fromSchema = (ast as any).from;
      if (fromSchema) {
        return getAnnotations(fromSchema);
      }
    }
    // Try to get annotations directly
    if ("annotations" in schema) {
      return (schema as any).annotations || {};
    }
    // Fallback: check AST for annotations
    if (ast && "annotations" in ast) {
      return (ast as any).annotations || {};
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Extract property metadata from a schema property
 */
function getPropertyMetadata(
  propertySchema: Schema.Schema<any>
): PropertyMetadata {
  const annotations = getAnnotations(propertySchema);
  const metadata: PropertyMetadata = {};

  if (annotations.dimension) {
    metadata.dimension = String(annotations.dimension);
  }
  if (annotations.defaultUnit) {
    metadata.defaultUnit = String(annotations.defaultUnit);
  }
  if (annotations.title) {
    metadata.title = String(annotations.title);
  }

  // Extract min/max from constraints
  const ast = Schema.ast(propertySchema);
  if (ast) {
    metadata.min = extractMinConstraint(ast);
    metadata.max = extractMaxConstraint(ast);
  }

  return metadata;
}

/**
 * Extract min constraint from schema AST
 */
function extractMinConstraint(ast: any): number | undefined {
  if (!ast) return undefined;

  // Check if this is a refinement with greaterThan
  if (ast._tag === "Refinement") {
    const predicate = ast.predicate;
    if (predicate && predicate._tag === "GreaterThan") {
      return predicate.min;
    }
    // Recursively check nested refinements
    if (ast.from) {
      const nested = extractMinConstraint(ast.from);
      if (nested !== undefined) return nested;
    }
  }

  // Check nested refinements (pipe chains)
  if (ast._tag === "Union" || ast._tag === "Tuple") {
    // Not applicable for min/max
    return undefined;
  }

  return undefined;
}

/**
 * Extract max constraint from schema AST
 */
function extractMaxConstraint(ast: any): number | undefined {
  if (!ast) return undefined;

  // Check if this is a refinement with lessThan or lessThanOrEqualTo
  if (ast._tag === "Refinement") {
    const predicate = ast.predicate;
    if (predicate && predicate._tag === "LessThan") {
      return predicate.max;
    }
    if (predicate && predicate._tag === "LessThanOrEqualTo") {
      return predicate.max;
    }
    // Recursively check nested refinements
    if (ast.from) {
      const nested = extractMaxConstraint(ast.from);
      if (nested !== undefined) return nested;
    }
  }

  return undefined;
}

/**
 * Check if a property is optional in a struct schema
 */
function isOptionalProperty(
  structSchema: Schema.Schema<any>,
  propertyName: string
): boolean {
  try {
    const ast = Schema.ast(structSchema);
    if (ast && ast._tag === "TypeLiteral") {
      const property = (ast as any).propertySignatures?.find(
        (p: any) => p.name === propertyName
      );
      if (property) {
        return property.type._tag === "Optional";
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get all property names from a struct schema
 */
function getPropertyNames(structSchema: Schema.Schema<any>): string[] {
  try {
    const ast = Schema.ast(structSchema);
    if (ast && ast._tag === "TypeLiteral") {
      return (ast as any).propertySignatures?.map((p: any) => p.name) || [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Get property schema from a struct schema
 */
function getPropertySchema(
  structSchema: Schema.Schema<any>,
  propertyName: string
): Schema.Schema<any> | undefined {
  try {
    const ast = Schema.ast(structSchema);
    if (ast && ast._tag === "TypeLiteral") {
      const property = (ast as any).propertySignatures?.find(
        (p: any) => p.name === propertyName
      );
      if (property) {
        // Unwrap Optional if needed
        if (property.type._tag === "Optional") {
          return property.type.element;
        }
        return property.type;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get complete schema metadata including all properties
 */
export function getSchemaMetadata(
  schemaSet: string,
  blockType: string
): SchemaMetadata | null {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return null;
  }

  const propertyNames = getPropertyNames(schema);
  const required: string[] = [];
  const optional: string[] = [];
  const properties: Record<string, PropertyMetadata> = {};

  for (const propName of propertyNames) {
    // Skip type and quantity as they're always present
    if (propName === "type" || propName === "quantity") {
      continue;
    }

    const isOptional = isOptionalProperty(schema, propName);
    if (isOptional) {
      optional.push(propName);
    } else {
      required.push(propName);
    }

    const propSchema = getPropertySchema(schema, propName);
    if (propSchema) {
      properties[propName] = getPropertyMetadata(propSchema);
    }
  }

  return {
    blockType,
    schemaSet,
    required,
    optional,
    properties,
  };
}

/**
 * Get property constraints (min/max) for a specific property
 */
export function getPropertyConstraints(
  schemaSet: string,
  blockType: string,
  propertyName: string
): { min?: number; max?: number } {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return {};
  }

  const propSchema = getPropertySchema(schema, propertyName);
  if (!propSchema) {
    return {};
  }

  const metadata = getPropertyMetadata(propSchema);
  return {
    min: metadata.min,
    max: metadata.max,
  };
}
