/**
 * Module lookup service for finding cost library modules from block types.
 *
 * Parses the cost library and provides lookup functionality to map
 * Dagger block types to cost library module IDs.
 */

import { readFile } from "fs/promises";
import { join, resolve } from "path";
import type { CostLibrary, CostLibraryModule } from "./types";
import { normalizeBlockTypeWithOverrides } from "./type-normalization";

// ============================================================================
// Types
// ============================================================================

export type ModuleInfo = {
  id: string; // e.g., "M0201"
  type: string; // e.g., "CaptureUnit"
  subtype: string | null; // e.g., "Amine" or null if no subtype
  costItemIds: string[]; // e.g., ["Item 023"]
  requiredParameters: ParameterInfo[];
};

export type ParameterInfo = {
  name: string; // e.g., "Mass flow"
  units: string; // e.g., "kg/h"
  costItemId: string; // Which cost item requires this parameter
};

export type ModuleLookupResult = {
  moduleId: string;
  costItemRefs: string[];
  requiredParameters: ParameterInfo[];
};

// ============================================================================
// Cost Library Loader
// ============================================================================

/**
 * Get the path to the cost library data directory.
 * Resolves relative to process.cwd() which should be the backend directory.
 */
function getLibraryDataPath(): string {
  // this reference directory will be removed in the future.
  // it was provided for reference only.
  // we will make a new directory for the cost library data.
  return resolve(process.cwd(), "reference/costing/data");
}

/**
 * Load a cost library by ID.
 */
export async function loadCostLibrary(libraryId: string): Promise<CostLibrary> {
  const libraryDataPath = getLibraryDataPath();
  const filePath = join(libraryDataPath, libraryId, "cost-library.json");
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as CostLibrary;
}

/**
 * List available cost library IDs.
 */
export async function listCostLibraries(): Promise<string[]> {
  const { readdir } = await import("fs/promises");
  const libraryDataPath = getLibraryDataPath();
  const entries = await readdir(libraryDataPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

// ============================================================================
// Module Index Builder
// ============================================================================

export type ModuleIndex = {
  /** Map of normalized type → subtype → ModuleInfo */
  byTypeAndSubtype: Map<string, Map<string, ModuleInfo>>;
  /** Map of module ID → ModuleInfo */
  byId: Map<string, ModuleInfo>;
  /** All modules */
  all: ModuleInfo[];
};

/**
 * Build a module index from a cost library for efficient lookup.
 */
export function buildModuleIndex(library: CostLibrary): ModuleIndex {
  const byTypeAndSubtype = new Map<string, Map<string, ModuleInfo>>();
  const byId = new Map<string, ModuleInfo>();
  const all: ModuleInfo[] = [];

  for (const module of library.modules) {
    const info = extractModuleInfo(module);
    all.push(info);
    byId.set(info.id, info);

    // Index by type → subtype
    if (!byTypeAndSubtype.has(info.type)) {
      byTypeAndSubtype.set(info.type, new Map());
    }
    // Handle modules without subtype
    const subtypeKey = info.subtype?.toLowerCase() ?? "";
    byTypeAndSubtype.get(info.type)!.set(subtypeKey, info);
  }

  return { byTypeAndSubtype, byId, all };
}

/**
 * Extract module info from a cost library module.
 */
function extractModuleInfo(module: CostLibraryModule): ModuleInfo {
  const costItemIds = module.cost_items?.map((item) => item.id) ?? [];

  // Collect all required parameters from cost items
  const requiredParameters: ParameterInfo[] = [];
  for (const costItem of module.cost_items ?? []) {
    for (const factor of costItem.scaling_factors ?? []) {
      requiredParameters.push({
        name: factor.name,
        units: factor.units,
        costItemId: costItem.id,
      });
    }
    // Also add variable OPEX parameters
    for (const opex of costItem.variable_opex_contributions ?? []) {
      requiredParameters.push({
        name: opex.name,
        units: opex.units,
        costItemId: costItem.id,
      });
    }
  }

  return {
    id: module.id,
    type: module.definition.type,
    subtype: module.subtype ?? null,
    costItemIds,
    requiredParameters,
  };
}

// ============================================================================
// Module Lookup Service
// ============================================================================

export type CostItemInfo = {
  id: string;
  info?: {
    item_type?: string;
    short_name?: string;
    description?: string;
  };
  scaling_factors: Array<{ name: string; units: string; source_value: number }>;
  variable_opex_contributions: Array<{
    name: string;
    units: string;
    scaled_by?: number;
  }>;
};

export class ModuleLookupService {
  private index: ModuleIndex;
  private library: CostLibrary;

  constructor(library: CostLibrary) {
    this.index = buildModuleIndex(library);
    this.library = library;
  }

  /**
   * Look up a module by user-provided block type and optional subtype.
   *
   * @param blockType User's block type (e.g., "Capture Unit")
   * @param subtype Optional subtype (e.g., "Amine")
   * @returns Module info, or undefined if not found
   */
  lookup(blockType: string, subtype?: string): ModuleInfo | undefined {
    // Normalize the block type
    const normalizedType = normalizeBlockTypeWithOverrides(blockType);

    const subtypeMap = this.index.byTypeAndSubtype.get(normalizedType);
    if (!subtypeMap) {
      return undefined;
    }

    // If subtype provided, look it up
    if (subtype) {
      return subtypeMap.get(subtype.toLowerCase());
    }

    // If no subtype, try empty string key (modules without subtype)
    if (subtypeMap.has("")) {
      return subtypeMap.get("");
    }

    // If no subtype and only one exists, return it
    if (subtypeMap.size === 1) {
      return subtypeMap.values().next().value;
    }

    return undefined; // Ambiguous - subtype required
  }

  /**
   * Get module by ID.
   */
  getById(moduleId: string): ModuleInfo | undefined {
    return this.index.byId.get(moduleId);
  }

  /**
   * List all modules.
   */
  listAll(): ModuleInfo[] {
    return this.index.all;
  }

  /**
   * List all unique types.
   */
  listTypes(): string[] {
    return Array.from(this.index.byTypeAndSubtype.keys());
  }

  /**
   * List subtypes for a given type.
   */
  listSubtypes(type: string): string[] {
    const normalizedType = normalizeBlockTypeWithOverrides(type);
    const subtypeMap = this.index.byTypeAndSubtype.get(normalizedType);
    if (!subtypeMap) {
      return [];
    }
    return Array.from(subtypeMap.values())
      .map((m) => m.subtype)
      .filter((s): s is string => s !== null);
  }

  /**
   * Find modules that match a given block type (all subtypes).
   */
  findByType(blockType: string): ModuleInfo[] {
    const normalizedType = normalizeBlockTypeWithOverrides(blockType);
    const subtypeMap = this.index.byTypeAndSubtype.get(normalizedType);
    if (!subtypeMap) {
      return [];
    }
    return Array.from(subtypeMap.values());
  }

  /**
   * Get full cost item info from a module.
   *
   * @param moduleId Module ID (e.g., "M0302")
   * @param costItemId Cost item ID (e.g., "Item 007")
   * @returns Full cost item info with scaling factors and OPEX contributions
   */
  getCostItem(moduleId: string, costItemId: string): CostItemInfo | undefined {
    const module = this.library.modules.find((m) => m.id === moduleId);
    if (!module) return undefined;

    const costItem = module.cost_items?.find((item) => item.id === costItemId);
    if (!costItem) return undefined;

    return {
      id: costItem.id,
      info: costItem.info,
      scaling_factors: costItem.scaling_factors ?? [],
      variable_opex_contributions: costItem.variable_opex_contributions ?? [],
    };
  }
}

// ============================================================================
// Singleton Cache
// ============================================================================

const serviceCache = new Map<string, ModuleLookupService>();

/**
 * Get or create a module lookup service for a given library.
 */
export async function getModuleLookupService(
  libraryId: string,
): Promise<ModuleLookupService> {
  if (!serviceCache.has(libraryId)) {
    const library = await loadCostLibrary(libraryId);
    serviceCache.set(libraryId, new ModuleLookupService(library));
  }
  return serviceCache.get(libraryId)!;
}

/**
 * Clear the service cache (useful for testing).
 */
export function clearModuleLookupCache(): void {
  serviceCache.clear();
}
