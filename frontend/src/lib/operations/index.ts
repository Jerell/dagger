/**
 * Operations module
 *
 * Provides the operation registry, types, and query functions for
 * running operations like costing on networks.
 */

// Types
export type {
  Operation,
  OperationValidation,
  AssetValidation,
  BlockValidation,
  Timeline,
  CostParameter,
  CapexLangFactors,
  FixedOpexFactors,
  AssetPropertyOverrides,
  NetworkSource,
  CostingEstimateRequest,
  CostingEstimateResponse,
  AssetCostResult,
  BlockCostResult,
  LifetimeCosts,
  LangFactoredCosts,
  FixedOpexCosts,
  VariableOpexCosts,
  CostLibrary,
  CostLibraryModule,
  CostLibraryType,
  HealthStatus,
} from "./types";

// Registry
export { OPERATIONS, getOperation, getOperations, hasOperation } from "./registry";

// Queries and API functions
export {
  // API functions
  runCostingEstimate,
  validateCostingNetwork,
  listCostLibraries,
  getCostLibraryTypes,
  getCostLibraryModules,
  checkCostingHealth,
  // Query options
  costingValidationQueryOptions,
  costLibrariesQueryOptions,
  costLibraryTypesQueryOptions,
  costLibraryModulesQueryOptions,
  costingHealthQueryOptions,
  // Helpers
  createCostingRequest,
  createNetworkSource,
} from "./queries";
