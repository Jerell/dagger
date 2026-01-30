/**
 * Effect Schemas for snapshot request/response validation.
 */

import * as S from "effect/Schema";
import { Either } from "effect";

// ============================================================================
// Unit Value Schema
// ============================================================================

/**
 * A unit value is an object with a single key (the unit) and a numeric or boolean value.
 * e.g., { "bara": 35 } or { "celsius": 55 } or { "boolean": true }
 */
export const UnitValueSchema = S.Record({
  key: S.String,
  value: S.Union(S.Number, S.Boolean),
});

// ============================================================================
// Conditions Schema
// ============================================================================

/**
 * Conditions are a flat map of pipe-separated keys to unit values.
 */
export const ConditionsSchema = S.Record({
  key: S.String,
  value: UnitValueSchema,
});

// ============================================================================
// Request Schemas
// ============================================================================

export const NetworkBlockSchema = S.mutable(
  S.Struct({
    type: S.String,
    quantity: S.optional(S.Number),
  }).pipe(S.extend(S.Record({ key: S.String, value: S.Unknown }))),
);

export const NetworkBranchSchema = S.mutable(
  S.Struct({
    id: S.String,
    label: S.optional(S.String),
    parentId: S.optional(S.String),
    blocks: S.mutable(S.Array(NetworkBlockSchema)),
  }),
);

export const NetworkGroupSchema = S.mutable(
  S.Struct({
    id: S.String,
    label: S.optional(S.String),
    branchIds: S.mutable(S.Array(S.String)),
  }),
);

export const NetworkDataSchema = S.mutable(
  S.Struct({
    groups: S.mutable(S.Array(NetworkGroupSchema)),
    branches: S.mutable(S.Array(NetworkBranchSchema)),
  }),
);

export const DataSourceSchema = S.mutable(
  S.Struct({
    type: S.Literal("data"),
    network: NetworkDataSchema,
  }),
);

export const NetworkIdSourceSchema = S.Struct({
  type: S.Literal("networkId"),
  networkId: S.String,
});

export const NetworkSourceSchema = S.Union(
  DataSourceSchema,
  NetworkIdSourceSchema,
);

/**
 * Network-level runtime parameters (temperatures in Celsius).
 */
export const NetworkConditionsSchema = S.Struct({
  airMedium: S.optional(S.Number),
  soilMedium: S.optional(S.Number),
  waterMedium: S.optional(S.Number),
});

export type NetworkConditionsInput = S.Schema.Type<
  typeof NetworkConditionsSchema
>;

export const SnapshotRunRequestSchema = S.Struct({
  source: NetworkSourceSchema,
  baseNetworkId: S.optional(S.String),
  includeAllPipes: S.optional(S.Boolean),
  networkConditions: S.optional(NetworkConditionsSchema),
});

export const SnapshotValidateRequestSchema = S.Struct({
  source: NetworkSourceSchema,
  baseNetworkId: S.optional(S.String),
});

// ============================================================================
// Network Structure Schemas (optional)
// ============================================================================

export const SubnetStructureSchema = S.Struct({
  subnetName: S.optional(S.String),
  downstreamSubnetName: S.optional(S.String),
  componentSeriesMap: S.optional(
    S.Record({ key: S.String, value: S.Array(S.String) }),
  ),
});

export const NetworkStructureSchema = S.Struct({
  subnets: S.optional(
    S.Record({ key: S.String, value: SubnetStructureSchema }),
  ),
  componentYamlFilenames: S.optional(S.Array(S.String)),
});

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Direct request with conditions already formatted.
 */
export const DirectSnapshotRequestSchema = S.Struct({
  type: S.Literal("direct"),
  conditions: ConditionsSchema,
  structure: S.optional(NetworkStructureSchema),
  includeAllPipes: S.optional(S.Boolean),
});

/**
 * Request using a preset network.
 */
export const NetworkSnapshotRequestSchema = S.Struct({
  type: S.Literal("network"),
  networkId: S.String,
  includeAllPipes: S.optional(S.Boolean),
});

/**
 * Union of both request types.
 */
export const SnapshotRequestSchema = S.Union(
  DirectSnapshotRequestSchema,
  NetworkSnapshotRequestSchema,
);

// Infer types from schemas
export type DirectSnapshotRequestInput = S.Schema.Type<
  typeof DirectSnapshotRequestSchema
>;
export type NetworkSnapshotRequestInput = S.Schema.Type<
  typeof NetworkSnapshotRequestSchema
>;
export type SnapshotRequestInput = S.Schema.Type<typeof SnapshotRequestSchema>;
export type ConditionsInput = S.Schema.Type<typeof ConditionsSchema>;

// ============================================================================
// Validation Helper
// ============================================================================

export type ValidationError = {
  message: string;
  path: string;
  received: unknown;
};

/**
 * Validate and decode a request body using Effect Schema.
 * Returns Either with parsed value or array of validation errors.
 */
export function validateRequest<A, I>(
  schema: S.Schema<A, I>,
  data: unknown,
): Either.Either<A, ValidationError[]> {
  const result = S.decodeUnknownEither(schema)(data);

  if (Either.isRight(result)) {
    return Either.right(result.right);
  }

  // Extract errors from ParseError
  const parseError = result.left;
  const errors: ValidationError[] = [];

  // Traverse the error structure to extract meaningful messages
  function extractErrors(error: unknown, path: string = ""): void {
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;

      if ("message" in err && typeof err.message === "string") {
        errors.push({
          message: err.message,
          path: path || "(root)",
          received: err.actual ?? undefined,
        });
      }

      if ("errors" in err && Array.isArray(err.errors)) {
        for (const subError of err.errors) {
          extractErrors(subError, path);
        }
      }

      if ("error" in err) {
        extractErrors(err.error, path);
      }
    }
  }

  extractErrors(parseError);

  // Fallback if no specific errors extracted
  if (errors.length === 0) {
    errors.push({
      message: String(parseError),
      path: "(root)",
      received: data,
    });
  }

  return Either.left(errors);
}

/**
 * Format validation errors for HTTP response.
 */
export function formatValidationErrors(errors: ValidationError[]): {
  error: string;
  details: ValidationError[];
} {
  return {
    error: "Invalid request body",
    details: errors,
  };
}
