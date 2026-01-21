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
