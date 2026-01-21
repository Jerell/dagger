/**
 * Request and response types for the costing API.
 * 
 * These types define the interface between the frontend and the local server's
 * costing adapter. Asset-level properties are provided at request time with
 * sensible defaults.
 */

import type {
  Timeline,
  CapexLangFactors,
  FixedOpexFactors,
  CostParameter,
} from "./types";
import {
  DEFAULT_TIMELINE,
  DEFAULT_LABOUR_AVERAGE_SALARY,
  DEFAULT_FTE_PERSONNEL,
  DEFAULT_ASSET_UPTIME,
  DEFAULT_DISCOUNT_RATE,
  DEFAULT_CAPEX_LANG_FACTORS,
  DEFAULT_OPEX_FACTORS,
} from "./defaults";

// ============================================================================
// Request Types
// ============================================================================

/**
 * Network data passed directly in request.
 */
export type NetworkData = {
  groups: NetworkGroup[];
  branches: NetworkBranch[];
};

export type NetworkGroup = {
  id: string;
  label?: string;
  branchIds: string[];
};

export type NetworkBranch = {
  id: string;
  label?: string;
  parentId?: string;
  blocks: NetworkBlock[];
};

export type NetworkBlock = {
  type: string;
  quantity?: number;
  [key: string]: unknown;
};

/**
 * Network source - discriminated union.
 * Either provide a path to read from disk, or pass network data directly.
 */
export type NetworkSource =
  | { type: "path"; path: string }
  | { type: "data"; network: NetworkData };

/**
 * Request body for costing estimate.
 */
export type CostingEstimateRequest = {
  /** Network source - either path or inline data */
  source: NetworkSource;
  
  /** Cost library to use (e.g., "V1.1_working") */
  libraryId: string;
  
  /** Target currency for results (e.g., "USD", "EUR") */
  targetCurrency?: string;
  
  /** 
   * Optional asset-level property overrides.
   * These apply to all assets unless per-asset overrides are specified.
   */
  assetDefaults?: AssetPropertyOverrides;
  
  /**
   * Per-asset overrides keyed by group ID or branch ID.
   * Takes precedence over assetDefaults.
   */
  assetOverrides?: Record<string, AssetPropertyOverrides>;
};

/**
 * Overridable asset-level properties.
 * All fields are optional - defaults from defaults.ts are used when not specified.
 */
export type AssetPropertyOverrides = {
  timeline?: Partial<Timeline>;
  labour_average_salary?: CostParameter;
  fte_personnel?: number;
  asset_uptime?: number;
  discount_rate?: number;
  capex_lang_factors?: Partial<CapexLangFactors>;
  opex_factors?: Partial<FixedOpexFactors>;
};

/**
 * Resolved asset properties with all defaults applied.
 */
export type ResolvedAssetProperties = {
  timeline: Timeline;
  labour_average_salary: CostParameter;
  fte_personnel: number;
  asset_uptime: number;
  discount_rate: number;
  capex_lang_factors: CapexLangFactors;
  opex_factors: FixedOpexFactors;
  /** Which fields are using defaults */
  usingDefaults: Set<string>;
};

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response from the costing estimate endpoint.
 */
export type CostingEstimateResponse = {
  /** Network ID */
  networkId: string;
  
  /** Network name (if available) */
  networkName?: string;
  
  /** Currency used for all amounts */
  currency: string;
  
  /** Network-level totals (undiscounted) */
  lifetimeCosts: LifetimeCosts;
  
  /** Network-level totals (discounted - Net Present Cost) */
  lifetimeNpcCosts: LifetimeCosts;
  
  /** Per-asset results */
  assets: AssetCostResult[];
  
  /** IDs of assets that used all defaults */
  assetsUsingDefaults: string[];
};

/**
 * Cost breakdown for an asset.
 */
export type AssetCostResult = {
  /** Asset ID (group ID or branch ID) */
  id: string;
  
  /** Asset name */
  name?: string;
  
  /** Whether this asset used default properties */
  isUsingDefaults: boolean;
  
  /** Which properties used defaults */
  propertiesUsingDefaults: string[];
  
  /** Lifetime costs (undiscounted) */
  lifetimeCosts: LifetimeCosts;
  
  /** Lifetime NPC (discounted) */
  lifetimeNpcCosts: LifetimeCosts;
  
  /** Per-block costs */
  blocks: BlockCostResult[];
};

/**
 * Cost breakdown for a block (module).
 */
export type BlockCostResult = {
  /** Block ID */
  id: string;
  
  /** Block type (e.g., "CaptureUnit") */
  blockType: string;
  
  /** Block subtype */
  subtype?: string;
  
  /** Module reference in cost library */
  moduleRef: string;
  
  /** Quantity */
  quantity: number;
  
  /** Direct equipment cost */
  directEquipmentCost: number;
  
  /** Total installed cost */
  totalInstalledCost: number;
};

/**
 * Lifetime cost breakdown.
 */
export type LifetimeCosts = {
  directEquipmentCost: number;
  langFactoredCapitalCost: LangFactoredCosts;
  totalInstalledCost: number;
  fixedOpexCost: FixedOpexCosts;
  variableOpexCost: VariableOpexCosts;
  decommissioningCost: number;
};

/**
 * Lang-factored capital cost breakdown.
 */
export type LangFactoredCosts = {
  equipmentErection: number;
  piping: number;
  instrumentation: number;
  electrical: number;
  buildingsAndProcess: number;
  utilities: number;
  storages: number;
  siteDevelopment: number;
  ancillaryBuildings: number;
  designAndEngineering: number;
  contractorsFee: number;
  contingency: number;
};

/**
 * Fixed OPEX cost breakdown.
 */
export type FixedOpexCosts = {
  maintenance: number;
  controlRoomFacilities: number;
  insuranceLiability: number;
  insuranceEquipmentLoss: number;
  costOfCapital: number;
  majorTurnarounds: number;
  labourCost: number;
};

/**
 * Variable OPEX cost breakdown.
 */
export type VariableOpexCosts = {
  electricity: number;
  naturalGas: number;
  water: number;
  other: number;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve asset properties by applying overrides to defaults.
 */
export function resolveAssetProperties(
  overrides?: AssetPropertyOverrides,
  globalOverrides?: AssetPropertyOverrides
): ResolvedAssetProperties {
  const usingDefaults = new Set<string>();
  
  // Start with defaults
  const timeline = { ...DEFAULT_TIMELINE };
  const capexLangFactors = { ...DEFAULT_CAPEX_LANG_FACTORS };
  const opexFactors = { ...DEFAULT_OPEX_FACTORS };
  let labourAverageSalary = { ...DEFAULT_LABOUR_AVERAGE_SALARY };
  let ftePersonnel = DEFAULT_FTE_PERSONNEL;
  let assetUptime = DEFAULT_ASSET_UPTIME;
  let discountRate = DEFAULT_DISCOUNT_RATE;
  
  // Track what's using defaults
  usingDefaults.add("timeline");
  usingDefaults.add("labour_average_salary");
  usingDefaults.add("fte_personnel");
  usingDefaults.add("asset_uptime");
  usingDefaults.add("discount_rate");
  usingDefaults.add("capex_lang_factors");
  usingDefaults.add("opex_factors");
  
  // Apply global overrides
  if (globalOverrides) {
    applyOverrides(globalOverrides);
  }
  
  // Apply per-asset overrides (takes precedence)
  if (overrides) {
    applyOverrides(overrides);
  }
  
  function applyOverrides(o: AssetPropertyOverrides) {
    if (o.timeline) {
      Object.assign(timeline, o.timeline);
      usingDefaults.delete("timeline");
    }
    if (o.labour_average_salary) {
      labourAverageSalary = o.labour_average_salary;
      usingDefaults.delete("labour_average_salary");
    }
    if (o.fte_personnel !== undefined) {
      ftePersonnel = o.fte_personnel;
      usingDefaults.delete("fte_personnel");
    }
    if (o.asset_uptime !== undefined) {
      assetUptime = o.asset_uptime;
      usingDefaults.delete("asset_uptime");
    }
    if (o.discount_rate !== undefined) {
      discountRate = o.discount_rate;
      usingDefaults.delete("discount_rate");
    }
    if (o.capex_lang_factors) {
      Object.assign(capexLangFactors, o.capex_lang_factors);
      usingDefaults.delete("capex_lang_factors");
    }
    if (o.opex_factors) {
      Object.assign(opexFactors, o.opex_factors);
      usingDefaults.delete("opex_factors");
    }
  }
  
  return {
    timeline,
    labour_average_salary: labourAverageSalary,
    fte_personnel: ftePersonnel,
    asset_uptime: assetUptime,
    discount_rate: discountRate,
    capex_lang_factors: capexLangFactors,
    opex_factors: opexFactors,
    usingDefaults,
  };
}
