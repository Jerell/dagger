/**
 * Snapshot service integration.
 *
 * Provides functionality to run flow simulations via the Scenario Modeller API.
 */

// Types
export * from "./types";

// Schemas
export {
  SnapshotRequestSchema,
  DirectSnapshotRequestSchema,
  NetworkSnapshotRequestSchema,
  ConditionsSchema,
  UnitValueSchema,
  validateRequest,
  formatValidationErrors,
  type SnapshotRequestInput,
  type DirectSnapshotRequestInput,
  type NetworkSnapshotRequestInput,
  type ConditionsInput,
  type ValidationError,
} from "./schemas";

// Adapter
export {
  transformScenarioResponse,
  isScenarioOk,
  buildConditionKey,
  pressureValue,
  temperatureValue,
  flowrateValue,
  booleanValue,
  scalarValue,
  molFractionValue,
} from "./adapter";

// Network Adapter
export {
  transformNetworkToSnapshotConditions,
  type NetworkData,
  type NetworkGroup,
  type NetworkBranch,
  type NetworkBlock,
  type NetworkEdge,
  type ConditionStatus,
  type ExtractedCondition,
  type ComponentValidation,
  type SeriesComponent,
  type Subnet,
  type NetworkStructure,
  type SnapshotTransformResult,
} from "./network-adapter";
