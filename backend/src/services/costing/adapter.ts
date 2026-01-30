/**
 * Costing Adapter
 *
 * Transforms Dagger networks into costing server requests and back.
 * This is the bridge between our operation-agnostic network format
 * and the costing server's expected format.
 */

import * as path from "path";
import * as fs from "fs/promises";
import { resolveNetworkPath } from "../../utils/network-path";
import type {
  CostEstimateRequest,
  AssetParameters,
  CostItemParameters,
  CostEstimateResponse,
} from "./types";
import type {
  CostingEstimateResponse,
  AssetCostResult,
  BlockCostResult,
  LifetimeCosts,
  LangFactoredCosts,
  FixedOpexCosts,
  VariableOpexCosts,
  NetworkSource,
  NetworkData,
  NetworkGroup,
  NetworkBranch,
  NetworkBlock,
} from "./request-types";
import { resolveAssetProperties } from "./request-types";
import {
  mapBlockToModule,
  mapBlockToModuleDetailed,
} from "./block-to-module-mapper";
import { getModuleLookupService } from "./module-lookup";
import dim from "../dim";
import { getDagger } from "../../utils/getDagger";

// ============================================================================
// Network Loading
// ============================================================================

type NetworkFiles = {
  files: Record<string, string>;
  configContent: string | null;
};

async function readNetworkFiles(networkPath: string): Promise<NetworkFiles> {
  const absolutePath = path.resolve(process.cwd(), networkPath);
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  const files: Record<string, string> = {};
  let configContent: string | null = null;

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".toml")) {
      const filePath = path.join(absolutePath, entry.name);
      const content = await fs.readFile(filePath, "utf-8");
      files[entry.name] = content;

      if (entry.name === "config.toml") {
        configContent = content;
      }
    }
  }

  return { files, configContent };
}

import {
  validateNetworkBlocks,
  getEnrichedBlockFromValidation,
  type ValidationResult,
  type Block,
  type NetworkSource as EffectNetworkSource,
} from "../effectValidation";

/**
 * Load network data from a source (inline data, networkId, or path).
 * Returns the network structure and the resolved path (for validation).
 */
async function loadNetworkData(
  source: NetworkSource,
): Promise<{ data: NetworkData; networkPath: string | null }> {
  if (source.type === "data") {
    return { data: source.network, networkPath: null };
  }

  // For networkId or path, resolve to an absolute path
  const networkPath =
    source.type === "path"
      ? source.path
      : resolveNetworkPath(source.networkId);

  // Load from path using WASM
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);
  const dagger = getDagger();

  // Query for all nodes
  const nodesResult = dagger.query_from_files(
    filesJson,
    configContent || undefined,
    "network/nodes",
  );
  const nodes: Array<{
    id: string;
    type?: string;
    label?: string;
    parentId?: string;
    blocks?: NetworkBlock[];
    data?: Record<string, unknown>;
  }> = JSON.parse(nodesResult);

  console.log("[costing adapter] Initial nodes count:", nodes.length);
  console.log(
    "[costing adapter] Node IDs:",
    nodes.map((n) => n.id),
  );

  // Separate groups and branches based on type
  const rawGroups = nodes.filter(
    (n) => n.type === "labeledGroup" || n.type === "group",
  );
  const rawBranches = nodes.filter((n) => n.type === "branch");

  console.log(
    "[costing adapter] Found",
    rawGroups.length,
    "groups:",
    rawGroups.map((g) => g.id),
  );
  console.log(
    "[costing adapter] Found",
    rawBranches.length,
    "branches:",
    rawBranches.map((b) => b.id),
  );

  // Build group objects
  const groups: NetworkGroup[] = rawGroups.map((g) => ({
    id: g.id,
    label: (g.label as string) ?? (g.data?.label as string | undefined),
    branchIds: rawBranches.filter((b) => b.parentId === g.id).map((b) => b.id),
  }));

  // Build branch objects with their blocks
  const branches: NetworkBranch[] = rawBranches.map((b) => ({
    id: b.id,
    label: b.label ?? (b.data?.label as string | undefined),
    parentId: b.parentId,
    blocks: b.blocks ?? [],
  }));

  return { data: { groups, branches }, networkPath };
}

// ============================================================================
// Transform: Network → CostEstimateRequest
// ============================================================================

import type { AssetPropertyOverrides } from "./request-types";

export type CostingTransformOptions = {
  libraryId: string;
  assetDefaults?: AssetPropertyOverrides;
  assetOverrides?: Record<string, AssetPropertyOverrides>;
};

export type CostingTransformResult = {
  request: CostEstimateRequest;
  assetMetadata: AssetMetadata[];
};

export type BlockValidation = {
  id: string;
  type: string;
  status: "costable" | "missing_properties" | "not_costable" | "unknown";
  /** Properties that are defined on this block */
  definedProperties: Record<string, unknown>;
  /** Properties that are required but missing */
  missingProperties: string[];
  /** Module it maps to (if costable) */
  moduleType?: string;
  moduleSubtype?: string;
};

export type AssetMetadata = {
  assetId: string;
  name?: string;
  isGroup: boolean;
  branchIds: string[];
  /** Total number of blocks in this asset */
  blockCount: number;
  /** Number of blocks that can be costed */
  costableBlockCount: number;
  /** Which asset-level properties are using defaults */
  usingDefaults: string[];
  /** Per-block validation details */
  blocks: BlockValidation[];
};

/**
 * Transform a Dagger network into a CostEstimateRequest for the costing server.
 *
 * @param source - Network source (path or inline data)
 * @param options - Transform options including library ID and asset overrides
 */
export async function transformNetworkToCostingRequest(
  source: NetworkSource,
  schemaSet: string,
  options: CostingTransformOptions,
): Promise<CostingTransformResult> {
  await dim.init();

  // Load network data from source
  const { data: networkData, networkPath } = await loadNetworkData(source);

  // Convert to effectValidation NetworkSource format
  // effectValidation only supports networkId and data, so we convert path sources
  // to data sources using the already-loaded networkData
  const effectSource: EffectNetworkSource =
    source.type === "networkId"
      ? { type: "networkId", networkId: source.networkId }
      : { type: "data", network: networkData as any };

  // Validate all blocks and get resolved properties
  const validationResults = await validateNetworkBlocks(
    effectSource,
    schemaSet,
  );

  // Get module lookup service
  const moduleLookup = await getModuleLookupService(options.libraryId);

  const { groups, branches } = networkData;

  // Build a map of branches by ID for quick lookup
  const branchById = new Map(branches.map((b) => [b.id, b]));

  // Find ungrouped branches (not in any group's branchIds)
  const groupedBranchIds = new Set(groups.flatMap((g) => g.branchIds));
  const ungroupedBranches = branches.filter((b) => !groupedBranchIds.has(b.id));

  const assets: AssetParameters[] = [];
  const assetMetadata: AssetMetadata[] = [];

  // Transform groups into named assets
  for (const group of groups) {
    const groupBranches = group.branchIds
      .map((id) => branchById.get(id))
      .filter((b): b is NetworkBranch => b !== undefined);

    if (groupBranches.length === 0) continue; // Skip empty groups

    const result = await transformGroupToAsset(
      group,
      groupBranches,
      moduleLookup,
      options,
      validationResults,
    );

    // Always add metadata (for validation), but only add asset if it has costable items
    assetMetadata.push(result.metadata);
    if (result.asset.cost_items.length > 0) {
      assets.push(result.asset);
    }
  }

  // Transform ungrouped branches into unnamed assets
  for (const branch of ungroupedBranches) {
    const result = await transformBranchToAsset(
      branch,
      moduleLookup,
      options,
      validationResults,
    );

    // Always add metadata (for validation), but only add asset if it has costable items
    assetMetadata.push(result.metadata);
    if (result.asset.cost_items.length > 0) {
      assets.push(result.asset);
    }
  }

  return {
    request: { assets },
    assetMetadata,
  };
}

/**
 * Validate a block and extract its properties.
 */
function validateBlock(block: NetworkBlock, blockId: string): BlockValidation {
  const mappingResult = mapBlockToModuleDetailed(block);

  // Extract defined properties (exclude type, quantity, kind, label)
  const excludeKeys = new Set(["type", "quantity", "kind", "label"]);
  const definedProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (!excludeKeys.has(key) && value !== undefined && value !== null) {
      definedProperties[key] = value;
    }
  }

  switch (mappingResult.status) {
    case "success":
      return {
        id: blockId,
        type: block.type,
        status: "costable",
        definedProperties,
        missingProperties: [],
        moduleType: mappingResult.mapping.moduleType,
        moduleSubtype: mappingResult.mapping.subtype ?? undefined,
      };
    case "missing_properties":
      return {
        id: blockId,
        type: block.type,
        status: "missing_properties",
        definedProperties,
        missingProperties: mappingResult.missingProperties,
      };
    case "not_costable":
      return {
        id: blockId,
        type: block.type,
        status: "not_costable",
        definedProperties,
        missingProperties: [],
      };
    case "unknown":
    default:
      return {
        id: blockId,
        type: block.type,
        status: "unknown",
        definedProperties,
        missingProperties: [],
      };
  }
}

/**
 * Transform a group (with its branches) into an asset.
 * Uses validation results which contain already-resolved properties.
 */
async function transformGroupToAsset(
  group: NetworkGroup,
  branches: NetworkBranch[],
  moduleLookup: Awaited<ReturnType<typeof getModuleLookupService>>,
  options: CostingTransformOptions,
  validationResults: Record<string, ValidationResult>,
): Promise<{ asset: AssetParameters; metadata: AssetMetadata }> {
  // Collect all blocks from all branches in this group
  const allCostItems: CostItemParameters[] = [];
  const branchIds: string[] = [];
  const blockValidations: BlockValidation[] = [];

  for (const branch of branches) {
    branchIds.push(branch.id);

    for (let i = 0; i < branch.blocks.length; i++) {
      const block = branch.blocks[i];
      const blockId = `${branch.id}/blocks/${i}`;

      // Get enriched block using validation results (properties already resolved)
      const enrichedBlock = getEnrichedBlockFromValidation(
        block as Block,
        validationResults,
        branch.id,
        i,
      ) as NetworkBlock;

      // Validate block for costing (map to cost module)
      const validation = validateBlock(enrichedBlock, blockId);
      blockValidations.push(validation);

      // Transform to cost items if costable
      if (validation.status === "costable") {
        const costItems = await transformBlockToCostItems(
          enrichedBlock,
          blockId,
          moduleLookup,
        );
        allCostItems.push(...costItems);
      }
    }
  }

  // Resolve asset properties (apply overrides)
  const overrides = options.assetOverrides?.[group.id];
  const resolved = resolveAssetProperties(overrides, options.assetDefaults);

  const asset: AssetParameters = {
    id: group.id,
    timeline: resolved.timeline,
    labour_average_salary: resolved.labour_average_salary,
    fte_personnel: resolved.fte_personnel,
    asset_uptime: resolved.asset_uptime,
    capex_lang_factors: resolved.capex_lang_factors,
    opex_factors: resolved.opex_factors,
    cost_items: allCostItems,
    discount_rate: resolved.discount_rate,
  };

  const metadata: AssetMetadata = {
    assetId: group.id,
    name: group.label || group.id,
    isGroup: true,
    branchIds,
    blockCount: blockValidations.length,
    costableBlockCount: blockValidations.filter((b) => b.status === "costable")
      .length,
    usingDefaults: Array.from(resolved.usingDefaults),
    blocks: blockValidations,
  };

  return { asset, metadata };
}

/**
 * Transform an ungrouped branch into an asset (uses defaults).
 * Uses validation results which contain already-resolved properties.
 */
async function transformBranchToAsset(
  branch: NetworkBranch,
  moduleLookup: Awaited<ReturnType<typeof getModuleLookupService>>,
  options: CostingTransformOptions,
  validationResults: Record<string, ValidationResult>,
): Promise<{ asset: AssetParameters; metadata: AssetMetadata }> {
  const costItems: CostItemParameters[] = [];
  const blockValidations: BlockValidation[] = [];

  for (let i = 0; i < branch.blocks.length; i++) {
    const block = branch.blocks[i];
    const blockId = `${branch.id}/blocks/${i}`;

    // Get enriched block using validation results (properties already resolved)
    const enrichedBlock = getEnrichedBlockFromValidation(
      block as Block,
      validationResults,
      branch.id,
      i,
    ) as NetworkBlock;

    // Validate block for costing (map to cost module)
    const validation = validateBlock(enrichedBlock, blockId);
    blockValidations.push(validation);

    // Transform to cost items if costable
    if (validation.status === "costable") {
      const blockCostItems = await transformBlockToCostItems(
        enrichedBlock,
        blockId,
        moduleLookup,
      );
      costItems.push(...blockCostItems);
    }
  }

  // Resolve asset properties (ungrouped branches use defaults unless overridden)
  const overrides = options.assetOverrides?.[branch.id];
  const resolved = resolveAssetProperties(overrides, options.assetDefaults);

  const asset: AssetParameters = {
    id: branch.id,
    timeline: resolved.timeline,
    labour_average_salary: resolved.labour_average_salary,
    fte_personnel: resolved.fte_personnel,
    asset_uptime: resolved.asset_uptime,
    capex_lang_factors: resolved.capex_lang_factors,
    opex_factors: resolved.opex_factors,
    cost_items: costItems,
    discount_rate: resolved.discount_rate,
  };

  const metadata: AssetMetadata = {
    assetId: branch.id,
    name: branch.label || branch.id,
    isGroup: false,
    branchIds: [branch.id],
    blockCount: blockValidations.length,
    costableBlockCount: blockValidations.filter((b) => b.status === "costable")
      .length,
    usingDefaults: Array.from(resolved.usingDefaults),
    blocks: blockValidations,
  };

  return { asset, metadata };
}

// ============================================================================
// Block → Cost Item Transformation
// ============================================================================

/**
 * Transform a block into cost items.
 *
 * A single block can produce multiple cost items because cost library modules
 * often have multiple components (e.g., LP Compression has a compressor + cooler).
 */
async function transformBlockToCostItems(
  block: NetworkBlock,
  blockPath: string,
  moduleLookup: Awaited<ReturnType<typeof getModuleLookupService>>,
): Promise<CostItemParameters[]> {
  // Map generic block to cost library module
  const mapping = mapBlockToModule(block);
  if (!mapping) {
    console.warn(`No module mapping found for block type: ${block.type}`);
    return [];
  }

  // Look up the module in the cost library
  const moduleInfo = moduleLookup.lookup(
    mapping.moduleType,
    mapping.subtype ?? undefined,
  );
  if (!moduleInfo) {
    console.warn(
      `Module not found in cost library: ${mapping.moduleType}/${mapping.subtype}`,
    );
    return [];
  }

  const costItems: CostItemParameters[] = [];
  const quantity = block.quantity ?? 1;

  // Create a cost item for each cost reference item in the module
  for (const costItemRef of moduleInfo.costItemIds) {
    const costItem = moduleLookup.getCostItem?.(moduleInfo.id, costItemRef);

    // Collect all required parameter names for this cost item
    const requiredParams: string[] = [];
    for (const sf of costItem?.scaling_factors ?? []) {
      requiredParams.push(sf.name);
    }
    for (const opex of costItem?.variable_opex_contributions ?? []) {
      requiredParams.push(opex.name);
    }

    const parameters = await extractParametersForCostItem(
      block,
      costItemRef,
      moduleInfo,
      moduleLookup,
    );

    // Check if we have ALL required parameters
    // A cost item should only be included if:
    // 1. It has no required parameters (fixed cost items), OR
    // 2. ALL required parameters are provided
    const providedParams = new Set(Object.keys(parameters));
    const hasAllRequiredParams = requiredParams.every((name) =>
      providedParams.has(name),
    );

    if (requiredParams.length === 0 || hasAllRequiredParams) {
      costItems.push({
        id: `${blockPath}/${costItemRef}`,
        ref: costItemRef,
        quantity,
        parameters,
      });
    }
  }

  return costItems;
}

/**
 * Extract parameters from a block that apply to a specific cost item.
 *
 * Block properties can be mapped to cost items in several ways:
 * 1. Direct match: block.compressor_duty → "Compressor Duty"
 * 2. Item-specific: block.electrical_power_compressor → "Electrical power" for Item 007
 */
async function extractParametersForCostItem(
  block: NetworkBlock,
  costItemRef: string,
  moduleInfo: {
    id: string;
    requiredParameters: Array<{
      name: string;
      units: string;
      costItemId?: string;
    }>;
  },
  moduleLookup: Awaited<ReturnType<typeof getModuleLookupService>>,
): Promise<Record<string, number>> {
  const parameters: Record<string, number> = {};

  // Get required parameters for this specific cost item
  const costItem = moduleLookup.getCostItem?.(moduleInfo.id, costItemRef);
  if (!costItem) {
    // Fall back to module-level parameters if we can't get item-specific ones
    return extractModuleLevelParameters(block, moduleInfo);
  }

  // Collect all parameter names needed for this cost item
  const requiredParams: Array<{ name: string; units: string }> = [];

  // Add scaling factors
  for (const sf of costItem.scaling_factors || []) {
    requiredParams.push({ name: sf.name, units: sf.units });
  }

  // Add variable OPEX contributions
  for (const opex of costItem.variable_opex_contributions || []) {
    requiredParams.push({ name: opex.name, units: opex.units });
  }

  // Try to find each parameter in the block
  for (const param of requiredParams) {
    const itemSuffix = getItemSuffix(costItemRef, costItem);
    const possibleBlockProps = mapCostParamToBlockProp(param.name);

    let value: unknown = undefined;

    // Try item-specific properties first (e.g., electrical_power_compressor)
    for (const prop of possibleBlockProps) {
      const itemSpecificProp = `${prop}_${itemSuffix}`;
      if (
        block[itemSpecificProp] !== undefined &&
        block[itemSpecificProp] !== null
      ) {
        value = block[itemSpecificProp];
        break;
      }
    }

    // Fall back to generic properties
    if (value === undefined || value === null) {
      for (const prop of possibleBlockProps) {
        if (block[prop] !== undefined && block[prop] !== null) {
          value = block[prop];
          break;
        }
      }
    }

    if (value !== undefined && value !== null) {
      const numericValue = await convertParameterValue(value, param.units);
      if (numericValue !== null) {
        parameters[param.name] = numericValue;
      }
    }
  }

  return parameters;
}

/**
 * Get a suffix to use for item-specific properties based on the cost item.
 * e.g., Item 007 (Compressor) → "compressor", Item 008 (After-cooler) → "cooler"
 */
function getItemSuffix(
  costItemRef: string,
  costItem: { info?: { item_type?: string } },
): string {
  // Map item types to property suffixes
  const itemTypeSuffixes: Record<string, string> = {
    Compressor: "compressor",
    "After-cooler": "cooler",
    Cooler: "cooler",
    Pump: "pump",
    Heater: "heater",
    Heating: "heater",
    Motor: "motor",
  };

  const itemType = costItem.info?.item_type;
  if (itemType && itemTypeSuffixes[itemType]) {
    return itemTypeSuffixes[itemType];
  }

  // Fall back to item number (e.g., "item_007")
  return costItemRef.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Map cost library parameter names to block property names.
 * Handles typos, special characters, and naming conventions.
 */
function mapCostParamToBlockProp(costParamName: string): string[] {
  // Explicit mappings for parameters that don't normalize cleanly
  const explicitMappings: Record<string, string[]> = {
    // Cost library typo: "moter" instead of "motor"
    "Pump moter rating": ["pump_motor_rating", "pump_moter_rating"],
    // Volumetric flowrate
    "Pump flowrate (volumetric)": ["pump_flowrate", "pump_flowrate_volumetric"],
    // Cooling water with temperature specification
    "Cooling water (10degC temp rise)": [
      "cooling_water",
      "cooling_water_10degc_temp_rise",
    ],
    // Heater duty capitalization
    "Heater Duty": ["heater_duty"],
    // Pipeline crossings - V1.1/V1.3 uses "Frequency of crossings per 10 km"
    "Frequency of crossings per 10 km": [
      "crossings_frequency",
      "frequency_of_crossings_per_10_km",
    ],
    // V2.0 uses "Number of crossings" - keep both for compatibility
    "Number of crossings": ["number_of_crossings", "crossings_frequency"],
  };

  if (explicitMappings[costParamName]) {
    return explicitMappings[costParamName];
  }

  // Default: normalize the parameter name
  return [normalizeParameterName(costParamName)];
}

/**
 * Fall back to extracting module-level parameters when we can't get item-specific info.
 */
async function extractModuleLevelParameters(
  block: NetworkBlock,
  moduleInfo: { requiredParameters: Array<{ name: string; units: string }> },
): Promise<Record<string, number>> {
  const parameters: Record<string, number> = {};

  for (const param of moduleInfo.requiredParameters) {
    const blockParamName = normalizeParameterName(param.name);
    const value = block[blockParamName];

    if (value !== undefined && value !== null) {
      const numericValue = await convertParameterValue(value, param.units);
      if (numericValue !== null) {
        parameters[param.name] = numericValue;
      }
    }
  }

  return parameters;
}

/**
 * Normalize parameter name from cost library format to block property format.
 * e.g., "Mass flow" → "mass_flow"
 */
function normalizeParameterName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Normalize unit strings for dim compatibility.
 * The cost library uses "m3/h" and "m3/hr" but dim requires "m^3/h".
 */
function normalizeDimUnits(units: string): string {
  // Replace patterns like "m3" with "m^3" for cubic meter
  // Be careful not to affect other units like "CO2"
  return units
    .replace(/\bm3\b/g, "m^3") // m3 → m^3
    .replace(/\bcm3\b/g, "cm^3") // cm3 → cm^3
    .replace(/\bkm3\b/g, "km^3") // km3 → km^3
    .replace(/\/hr\b/g, "/h") // hr → h (dim uses h for hour)
    .replace(/\b(\d+)([a-zA-Z]+)3\b/g, "$1$2^3"); // Handle other cases
}

/**
 * Convert a parameter value to the target units using dim.
 */
async function convertParameterValue(
  value: unknown,
  targetUnits: string,
): Promise<number | null> {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    try {
      // Try parsing as a plain number first
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && !value.match(/[a-zA-Z]/)) {
        return parsed;
      }

      // Try converting unit string using dim (e.g., "100 kg/h" → target units)
      // dim.eval converts to base units, so we need to express the conversion
      if (targetUnits && value.trim()) {
        // Normalize target units for dim compatibility
        const normalizedTarget = normalizeDimUnits(targetUnits);

        // Expression like "(100 t/h) / (1 kg/h)" gives the numeric value in kg/h
        const conversionExpr = `(${value}) / (1 ${normalizedTarget})`;
        const result = dim.eval(conversionExpr);
        const numericResult = parseFloat(result);
        if (!isNaN(numericResult)) {
          return numericResult;
        }
      }

      // Fallback: try parsing as a plain number
      if (!isNaN(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn(
        `Failed to convert value "${value}" to ${targetUnits}:`,
        error,
      );
    }
  }

  return null;
}

// ============================================================================
// Transform: CostEstimateResponse → CostingEstimateResponse
// ============================================================================

/**
 * Transform the costing server response into our format.
 */
export function transformCostingResponse(
  response: CostEstimateResponse,
  assetMetadata: AssetMetadata[],
  currency: string,
): CostingEstimateResponse {
  const metadataMap = new Map(assetMetadata.map((m) => [m.assetId, m]));

  // Build per-asset results
  const assets: AssetCostResult[] = response.assets.map((assetResponse) => {
    const metadata = metadataMap.get(assetResponse.id);

    return {
      id: assetResponse.id,
      name: metadata?.name,
      isUsingDefaults: (metadata?.usingDefaults.length ?? 0) > 0,
      propertiesUsingDefaults: metadata?.usingDefaults ?? [],
      lifetimeCosts: transformLifetimeCosts(assetResponse.lifetime_costs),
      lifetimeNpcCosts: transformLifetimeCosts(
        assetResponse.lifetime_dcf_costs,
      ),
      blocks: assetResponse.cost_items.map((item) => transformBlockCost(item)),
    };
  });

  // Calculate network-level totals
  const networkLifetimeCosts = aggregateLifetimeCosts(
    assets.map((a) => a.lifetimeCosts),
  );
  const networkLifetimeNpcCosts = aggregateLifetimeCosts(
    assets.map((a) => a.lifetimeNpcCosts),
  );

  return {
    networkId: "network",
    currency,
    lifetimeCosts: networkLifetimeCosts,
    lifetimeNpcCosts: networkLifetimeNpcCosts,
    assets,
    assetsUsingDefaults: assets
      .filter((a) => a.isUsingDefaults)
      .map((a) => a.id),
  };
}

function transformLifetimeCosts(
  costs: CostEstimateResponse["assets"][0]["lifetime_costs"],
): LifetimeCosts {
  return {
    directEquipmentCost: costs.direct_equipment_cost,
    langFactoredCapitalCost: transformLangFactoredCosts(
      costs.lang_factored_capital_cost,
    ),
    totalInstalledCost: costs.total_installed_cost,
    fixedOpexCost: transformFixedOpexCosts(costs.fixed_opex_cost),
    variableOpexCost: transformVariableOpexCosts(costs.variable_opex_cost),
    decommissioningCost: costs.decommissioning_cost,
  };
}

function transformLangFactoredCosts(
  costs: CostEstimateResponse["assets"][0]["lifetime_costs"]["lang_factored_capital_cost"],
): LangFactoredCosts {
  return {
    equipmentErection: costs.equipment_erection,
    piping: costs.piping,
    instrumentation: costs.instrumentation,
    electrical: costs.electrical,
    buildingsAndProcess: costs.buildings_and_process,
    utilities: costs.utilities,
    storages: costs.storages,
    siteDevelopment: costs.site_development,
    ancillaryBuildings: costs.ancillary_buildings,
    designAndEngineering: costs.design_and_engineering,
    contractorsFee: costs.contractors_fee,
    contingency: costs.contingency,
  };
}

function transformFixedOpexCosts(
  costs: CostEstimateResponse["assets"][0]["lifetime_costs"]["fixed_opex_cost"],
): FixedOpexCosts {
  return {
    maintenance: costs.maintenance,
    controlRoomFacilities: costs.control_room_facilities,
    insuranceLiability: costs.insurance_liability,
    insuranceEquipmentLoss: costs.insurance_equipment_loss,
    costOfCapital: costs.cost_of_capital,
    majorTurnarounds: costs.major_turnarounds,
    labourCost: 0, // Calculated separately in the costing server
  };
}

function transformVariableOpexCosts(
  costs: CostEstimateResponse["assets"][0]["lifetime_costs"]["variable_opex_cost"],
): VariableOpexCosts {
  return {
    electricity: costs.electrical_power,
    naturalGas: costs.natural_gas,
    water: costs.cooling_water,
    other:
      costs.catalysts_and_chemicals +
      costs.equipment_item_rental +
      costs.tariff,
  };
}

function transformBlockCost(
  item: CostEstimateResponse["assets"][0]["cost_items"][0],
): BlockCostResult {
  return {
    id: item.id,
    blockType: "", // Would need to be looked up from the original block
    moduleRef: "", // Would need the ref from the request
    quantity: item.quantity,
    directEquipmentCost: item.lifetime_costs.direct_equipment_cost ?? 0,
    totalInstalledCost: item.lifetime_costs.total_installed_cost ?? 0,
  };
}

function aggregateLifetimeCosts(costs: LifetimeCosts[]): LifetimeCosts {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return {
    directEquipmentCost: sum(costs.map((c) => c.directEquipmentCost)),
    langFactoredCapitalCost: {
      equipmentErection: sum(
        costs.map((c) => c.langFactoredCapitalCost.equipmentErection),
      ),
      piping: sum(costs.map((c) => c.langFactoredCapitalCost.piping)),
      instrumentation: sum(
        costs.map((c) => c.langFactoredCapitalCost.instrumentation),
      ),
      electrical: sum(costs.map((c) => c.langFactoredCapitalCost.electrical)),
      buildingsAndProcess: sum(
        costs.map((c) => c.langFactoredCapitalCost.buildingsAndProcess),
      ),
      utilities: sum(costs.map((c) => c.langFactoredCapitalCost.utilities)),
      storages: sum(costs.map((c) => c.langFactoredCapitalCost.storages)),
      siteDevelopment: sum(
        costs.map((c) => c.langFactoredCapitalCost.siteDevelopment),
      ),
      ancillaryBuildings: sum(
        costs.map((c) => c.langFactoredCapitalCost.ancillaryBuildings),
      ),
      designAndEngineering: sum(
        costs.map((c) => c.langFactoredCapitalCost.designAndEngineering),
      ),
      contractorsFee: sum(
        costs.map((c) => c.langFactoredCapitalCost.contractorsFee),
      ),
      contingency: sum(costs.map((c) => c.langFactoredCapitalCost.contingency)),
    },
    totalInstalledCost: sum(costs.map((c) => c.totalInstalledCost)),
    fixedOpexCost: {
      maintenance: sum(costs.map((c) => c.fixedOpexCost.maintenance)),
      controlRoomFacilities: sum(
        costs.map((c) => c.fixedOpexCost.controlRoomFacilities),
      ),
      insuranceLiability: sum(
        costs.map((c) => c.fixedOpexCost.insuranceLiability),
      ),
      insuranceEquipmentLoss: sum(
        costs.map((c) => c.fixedOpexCost.insuranceEquipmentLoss),
      ),
      costOfCapital: sum(costs.map((c) => c.fixedOpexCost.costOfCapital)),
      majorTurnarounds: sum(costs.map((c) => c.fixedOpexCost.majorTurnarounds)),
      labourCost: sum(costs.map((c) => c.fixedOpexCost.labourCost)),
    },
    variableOpexCost: {
      electricity: sum(costs.map((c) => c.variableOpexCost.electricity)),
      naturalGas: sum(costs.map((c) => c.variableOpexCost.naturalGas)),
      water: sum(costs.map((c) => c.variableOpexCost.water)),
      other: sum(costs.map((c) => c.variableOpexCost.other)),
    },
    decommissioningCost: sum(costs.map((c) => c.decommissioningCost)),
  };
}
