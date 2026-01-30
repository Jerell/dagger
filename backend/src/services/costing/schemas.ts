/**
 * Effect Schemas for costing request/response validation.
 */

import * as S from "effect/Schema";

// ============================================================================
// Network Data Schemas
// ============================================================================

export const NetworkBlockSchema = S.mutable(
  S.Struct({
    type: S.String,
    quantity: S.optional(S.Number),
  }).pipe(
    S.extend(
      S.Record({
        key: S.String,
        value: S.Union(S.String, S.Number, S.Null, S.Undefined),
      }),
    ),
  ),
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

// ============================================================================
// Network Source Schema (Discriminated Union)
// ============================================================================

export const DataSourceSchema = S.mutable(
  S.Struct({
    type: S.Literal("data"),
    network: NetworkDataSchema,
  }),
);

export const NetworkIdSourceSchema = S.mutable(
  S.Struct({
    type: S.Literal("networkId"),
    networkId: S.String,
  }),
);

export const NetworkSourceSchema = S.Union(
  DataSourceSchema,
  NetworkIdSourceSchema,
);

// ============================================================================
// Asset Property Schemas
// ============================================================================

export const TimelineSchema = S.Struct({
  construction_start: S.Number,
  construction_finish: S.Number,
  operation_start: S.Number,
  operation_finish: S.Number,
  decommissioning_start: S.Number,
  decommissioning_finish: S.Number,
});

export const CostParameterSchema = S.Struct({
  currency_code: S.String,
  amount: S.Number,
});

export const CapexLangFactorsSchema = S.Struct({
  equipment_erection: S.Number,
  piping: S.Number,
  instrumentation: S.Number,
  electrical: S.Number,
  buildings_and_process: S.Number,
  utilities: S.Number,
  storages: S.Number,
  site_development: S.Number,
  ancillary_buildings: S.Number,
  design_and_engineering: S.Number,
  contractors_fee: S.Number,
  contingency: S.Number,
});

export const FixedOpexFactorsSchema = S.Struct({
  maintenance: S.Number,
  control_room_facilities: S.Number,
  insurance_liability: S.Number,
  insurance_equipment_loss: S.Number,
  cost_of_capital: S.Number,
  major_turnarounds: S.Number,
});

export const AssetPropertyOverridesSchema = S.Struct({
  timeline: S.optional(S.partial(TimelineSchema)),
  labour_average_salary: S.optional(CostParameterSchema),
  fte_personnel: S.optional(S.Number),
  asset_uptime: S.optional(S.Number),
  discount_rate: S.optional(S.Number),
  capex_lang_factors: S.optional(S.partial(CapexLangFactorsSchema)),
  opex_factors: S.optional(S.partial(FixedOpexFactorsSchema)),
});

// ============================================================================
// Request Schemas
// ============================================================================

export const CostingEstimateRequestSchema = S.mutable(
  S.Struct({
    source: NetworkSourceSchema,
    libraryId: S.String,
    targetCurrency: S.optional(S.String),
    assetDefaults: S.optional(AssetPropertyOverridesSchema),
    assetOverrides: S.optional(
      S.mutable(
        S.Record({ key: S.String, value: AssetPropertyOverridesSchema }),
      ),
    ),
  }),
);

// Infer types from schemas
export type NetworkBlockInput = S.Schema.Type<typeof NetworkBlockSchema>;
export type NetworkBranchInput = S.Schema.Type<typeof NetworkBranchSchema>;
export type NetworkGroupInput = S.Schema.Type<typeof NetworkGroupSchema>;
export type NetworkDataInput = S.Schema.Type<typeof NetworkDataSchema>;
export type NetworkSourceInput = S.Schema.Type<typeof NetworkSourceSchema>;
export type CostingEstimateRequestInput = S.Schema.Type<
  typeof CostingEstimateRequestSchema
>;

// ============================================================================
// Validation Helper
// ============================================================================

import { Either } from "effect";

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
