/**
 * Default values for costing asset parameters.
 * 
 * These defaults are used for ungrouped branches (unnamed assets)
 * or when group properties are not fully specified.
 * 
 * Values sourced from existing costing tool frontend.
 */

import type {
  Timeline,
  CostParameter,
  CapexLangFactors,
  FixedOpexFactors,
} from "./types";

export const DEFAULT_TIMELINE: Timeline = {
  construction_start: 2025,
  construction_finish: 2026,
  operation_start: 2027,
  operation_finish: 2046,
  decommissioning_start: 2047,
  decommissioning_finish: 2047,
};

export const DEFAULT_LABOUR_AVERAGE_SALARY: CostParameter = {
  currency_code: "USD",
  amount: 55000,
};

export const DEFAULT_FTE_PERSONNEL = 5;

export const DEFAULT_ASSET_UPTIME = 0.95;

export const DEFAULT_DISCOUNT_RATE = 0.1;

export const DEFAULT_CAPEX_LANG_FACTORS: CapexLangFactors = {
  equipment_erection: 0.4,
  piping: 0.7,
  instrumentation: 0.2,
  electrical: 0.1,
  buildings_and_process: 0.15,
  utilities: 0.5,
  storages: 0.15,
  site_development: 0.05,
  ancillary_buildings: 0.15,
  design_and_engineering: 0.3,
  contractors_fee: 0.05,
  contingency: 1.0,
};

export const DEFAULT_OPEX_FACTORS: FixedOpexFactors = {
  maintenance: 0.08,
  control_room_facilities: 0.0,
  insurance_liability: 0.0,
  insurance_equipment_loss: 0.0,
  cost_of_capital: 0.0,
  major_turnarounds: 0.0,
};

/**
 * Check if a value is using the default.
 * Useful for displaying "using defaults" indicator.
 */
export function isUsingDefaultTimeline(timeline: Timeline): boolean {
  return (
    timeline.construction_start === DEFAULT_TIMELINE.construction_start &&
    timeline.construction_finish === DEFAULT_TIMELINE.construction_finish &&
    timeline.operation_start === DEFAULT_TIMELINE.operation_start &&
    timeline.operation_finish === DEFAULT_TIMELINE.operation_finish &&
    timeline.decommissioning_start === DEFAULT_TIMELINE.decommissioning_start &&
    timeline.decommissioning_finish === DEFAULT_TIMELINE.decommissioning_finish
  );
}

export function isUsingDefaultLangFactors(factors: CapexLangFactors): boolean {
  return (
    factors.equipment_erection === DEFAULT_CAPEX_LANG_FACTORS.equipment_erection &&
    factors.piping === DEFAULT_CAPEX_LANG_FACTORS.piping &&
    factors.instrumentation === DEFAULT_CAPEX_LANG_FACTORS.instrumentation &&
    factors.electrical === DEFAULT_CAPEX_LANG_FACTORS.electrical &&
    factors.buildings_and_process === DEFAULT_CAPEX_LANG_FACTORS.buildings_and_process &&
    factors.utilities === DEFAULT_CAPEX_LANG_FACTORS.utilities &&
    factors.storages === DEFAULT_CAPEX_LANG_FACTORS.storages &&
    factors.site_development === DEFAULT_CAPEX_LANG_FACTORS.site_development &&
    factors.ancillary_buildings === DEFAULT_CAPEX_LANG_FACTORS.ancillary_buildings &&
    factors.design_and_engineering === DEFAULT_CAPEX_LANG_FACTORS.design_and_engineering &&
    factors.contractors_fee === DEFAULT_CAPEX_LANG_FACTORS.contractors_fee &&
    factors.contingency === DEFAULT_CAPEX_LANG_FACTORS.contingency
  );
}

export function isUsingDefaultOpexFactors(factors: FixedOpexFactors): boolean {
  return (
    factors.maintenance === DEFAULT_OPEX_FACTORS.maintenance &&
    factors.control_room_facilities === DEFAULT_OPEX_FACTORS.control_room_facilities &&
    factors.insurance_liability === DEFAULT_OPEX_FACTORS.insurance_liability &&
    factors.insurance_equipment_loss === DEFAULT_OPEX_FACTORS.insurance_equipment_loss &&
    factors.cost_of_capital === DEFAULT_OPEX_FACTORS.cost_of_capital &&
    factors.major_turnarounds === DEFAULT_OPEX_FACTORS.major_turnarounds
  );
}
