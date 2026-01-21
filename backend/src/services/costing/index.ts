/**
 * Costing server integration services.
 */

// Types
export * from "./types";

// Type normalization
export {
  normalizeBlockType,
  normalizeBlockTypeWithOverrides,
  denormalizeBlockType,
} from "./type-normalization";

// Module lookup
export {
  loadCostLibrary,
  listCostLibraries,
  buildModuleIndex,
  ModuleLookupService,
  getModuleLookupService,
  clearModuleLookupCache,
  type ModuleInfo,
  type ParameterInfo,
  type ModuleLookupResult,
  type ModuleIndex,
} from "./module-lookup";

// Defaults
export {
  DEFAULT_TIMELINE,
  DEFAULT_LABOUR_AVERAGE_SALARY,
  DEFAULT_FTE_PERSONNEL,
  DEFAULT_ASSET_UPTIME,
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_CAPEX_LANG_FACTORS,
  DEFAULT_OPEX_FACTORS,
  isUsingDefaultTimeline,
  isUsingDefaultLangFactors,
  isUsingDefaultOpexFactors,
} from "./defaults";

// Request/Response types
export {
  type CostingEstimateRequest,
  type CostingEstimateResponse,
  type AssetPropertyOverrides,
  type ResolvedAssetProperties,
  type AssetCostResult,
  type BlockCostResult,
  type LifetimeCosts,
  type LangFactoredCosts,
  type FixedOpexCosts,
  type VariableOpexCosts,
  type NetworkSource,
  type NetworkData,
  type NetworkGroup,
  type NetworkBranch,
  type NetworkBlock,
  resolveAssetProperties,
} from "./request-types";

// Block to module mapper
export { mapBlockToModule, type ModuleMapping } from "./block-to-module-mapper";

// Adapter
export {
  transformNetworkToCostingRequest,
  transformCostingResponse,
  type TransformOptions,
  type TransformResult,
  type AssetMetadata,
} from "./adapter";

// Effect Schemas
export {
  CostingEstimateRequestSchema,
  NetworkSourceSchema,
  NetworkDataSchema,
  NetworkBlockSchema,
  NetworkBranchSchema,
  NetworkGroupSchema,
  AssetPropertyOverridesSchema,
  validateRequest,
  formatValidationErrors,
  type CostingEstimateRequestInput,
  type NetworkSourceInput,
  type NetworkDataInput,
  type ValidationError,
} from "./schemas";
