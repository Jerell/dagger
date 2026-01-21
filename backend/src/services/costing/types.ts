/**
 * Types for the costing server integration.
 * These mirror the Rust types from the costing server.
 */

// ============================================================================
// Cost Library Types (from cost-library.json)
// ============================================================================

export type CostLibrary = {
  modules: CostLibraryModule[];
};

export type CostLibraryModule = {
  id: string;
  definition: ModuleDefinition;
  subtype: string;
  cost_items: CostLibraryCostItem[];
};

export type ModuleDefinition = {
  type: string;
  [key: string]: unknown; // Additional type-specific fields
};

export type CostLibraryCostItem = {
  id: string;
  info: CostItemInfo;
  scaling_factors: ScalingFactor[];
  capex_contribution: CapexContribution;
  variable_opex_contributions: VariableOpexContribution[];
};

export type CostItemInfo = {
  reference_quality: string;
  item_type: string;
  short_name: string;
  description: string;
  source_reference: string;
  source_reference_detail: string | null;
  confidentiality: string;
  cost_type: string | null;
  cost_location: string | null;
  note: string | null;
};

export type ScalingFactor = {
  name: string;
  units: string;
  source_value: number;
};

export type CapexContribution = {
  year: number;
  currency: string;
  cost: {
    type: string;
    base_cost: number;
  };
};

export type VariableOpexContribution = {
  name: string;
  units: string;
  scaled_by: number;
};

// ============================================================================
// Request Types (for calling costing server)
// ============================================================================

export type CostEstimateRequest = {
  assets: AssetParameters[];
};

export type AssetParameters = {
  id: string;
  timeline: Timeline;
  labour_average_salary: CostParameter;
  fte_personnel: number;
  asset_uptime: number;
  capex_lang_factors: CapexLangFactors;
  opex_factors: FixedOpexFactors;
  cost_items: CostItemParameters[];
  discount_rate: number;
};

export type Timeline = {
  construction_start: number;
  construction_finish: number;
  operation_start: number;
  operation_finish: number;
  decommissioning_start: number;
  decommissioning_finish: number;
};

export type CostParameter = {
  currency_code: string;
  amount: number;
};

export type CapexLangFactors = {
  equipment_erection: number;
  piping: number;
  instrumentation: number;
  electrical: number;
  buildings_and_process: number;
  utilities: number;
  storages: number;
  site_development: number;
  ancillary_buildings: number;
  design_and_engineering: number;
  contractors_fee: number;
  contingency: number;
};

export type FixedOpexFactors = {
  maintenance: number;
  control_room_facilities: number;
  insurance_liability: number;
  insurance_equipment_loss: number;
  cost_of_capital: number;
  major_turnarounds: number;
};

export type CostItemParameters = {
  id: string;
  ref: string; // Reference to cost library cost item (e.g., "Item 023")
  quantity: number;
  parameters: Record<string, number>;
};

// ============================================================================
// Response Types (from costing server)
// ============================================================================

export type CostEstimateResponse = {
  assets: AssetCostEstimate[];
};

export type AssetCostEstimate = {
  id: string;
  costs: AssetCosts;
  costs_by_year: YearAssetCosts[];
  lifetime_costs: AssetPeriodCosts;
  lifetime_dcf_costs: AssetPeriodCosts;
  cost_items: CostItemCostEstimate[];
};

export type AssetCosts = {
  direct_equipment_cost: number;
  lang_factored_capital_cost: LangFactoredCostEstimate;
  total_installed_cost: number;
  fixed_opex_cost_per_year: FixedOpexCostEstimate;
  variable_opex_cost_per_year: VariableOpexCostEstimate;
  decommissioning_cost: number;
};

export type YearAssetCosts = {
  year: number;
  costs_in_year: AssetPeriodCosts;
  dcf_costs_in_year: AssetPeriodCosts;
};

export type AssetPeriodCosts = {
  direct_equipment_cost: number;
  lang_factored_capital_cost: LangFactoredCostEstimate;
  total_installed_cost: number;
  fixed_opex_cost: FixedOpexCostEstimate;
  variable_opex_cost: VariableOpexCostEstimate;
  decommissioning_cost: number;
};

export type CostItemCostEstimate = {
  id: string;
  quantity: number;
  costs: CostItemCosts;
  costs_by_year: YearCostItemCosts[];
  lifetime_costs: CostItemPeriodCosts;
  lifetime_dcf_costs: CostItemPeriodCosts;
};

export type CostItemCosts = {
  direct_equipment_cost: number | null;
  total_installed_cost: number | null;
  variable_opex_cost_per_year: VariableOpexCostEstimate;
};

export type YearCostItemCosts = {
  year: number;
  costs_in_year: CostItemPeriodCosts;
  dcf_costs_in_year: CostItemPeriodCosts;
};

export type CostItemPeriodCosts = {
  direct_equipment_cost: number | null;
  total_installed_cost: number | null;
  variable_opex_cost: VariableOpexCostEstimate;
};

export type LangFactoredCostEstimate = {
  equipment_erection: number;
  piping: number;
  instrumentation: number;
  electrical: number;
  buildings_and_process: number;
  utilities: number;
  storages: number;
  site_development: number;
  ancillary_buildings: number;
  design_and_engineering: number;
  contractors_fee: number;
  contingency: number;
};

export type FixedOpexCostEstimate = {
  maintenance: number;
  control_room_facilities: number;
  insurance_liability: number;
  insurance_equipment_loss: number;
  cost_of_capital: number;
  major_turnarounds: number;
};

export type VariableOpexCostEstimate = {
  electrical_power: number;
  cooling_water: number;
  natural_gas: number;
  steam_hp_superheated: number;
  steam_lp_saturated: number;
  catalysts_and_chemicals: number;
  equipment_item_rental: number;
  cost_per_tonne_of_co2: number;
  tariff: number;
};

// ============================================================================
// Error Types
// ============================================================================

export type CostEstimateError = {
  type: "MissingProperties" | "UnknownCostItem" | "UnknownCurrencyConversion" | "UnknownInflationFactor";
  properties?: MissingProperty[];
  id?: string;
  currency?: string;
  year?: string;
};

export type MissingProperty = {
  id: string;
  property: string;
};
