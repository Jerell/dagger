use cost_library::CostLibrary;
use poem_openapi::payload::Json;

use crate::route::cost::estimate::{
    linked_cost_item::{CostReferenceItems, LinkedCostItem},
    request::AssetParameters,
    response::{
        AssetCostEstimate, AssetCosts, AssetPeriodCosts, CostEstimate, CostEstimateError,
        CostEstimateErrorUnknownCurrencyConversion, CostItemCostEstimate, CostItemPeriodCosts,
        FixedOpexCostEstimate, LangFactoredCostEstimate, VariableOpexCostEstimate, YearAssetCosts,
        YearCostItemCosts,
    },
};
pub use crate::route::cost::estimate::{
    request::CostEstimateRequest, response::CostEstimateResponse,
};

mod cost_calculator;
mod linked_cost_item;
mod request;
mod response;

struct CostEstimateOptionsInternal {
    /// Factor to convert from the base currency to the target currency
    target_currency_rate: f64,
}

impl Default for CostEstimateOptionsInternal {
    fn default() -> Self {
        Self {
            target_currency_rate: 1.0,
        }
    }
}

#[derive(Debug)]
pub struct CostEstimateOptions<'a> {
    pub target_currency: Option<&'a str>,
}

impl<'a> CostEstimateOptions<'a> {
    fn convert_to_internal(
        &self,
        cost_library: &CostLibrary,
    ) -> Result<CostEstimateOptionsInternal, CostEstimateError> {
        let target_currency_code = self
            .target_currency
            .unwrap_or(&cost_library.currency_conversion.base_currency);
        let target_currency_rate = cost_library
            .currency_conversion
            .rates
            .get(target_currency_code)
            .map(|rate| 1.0 / rate)
            .ok_or_else(|| {
                CostEstimateError::UnknownCurrencyConversion(
                    CostEstimateErrorUnknownCurrencyConversion {
                        currency: target_currency_code.to_string(),
                    },
                )
            })?;

        Ok(CostEstimateOptionsInternal {
            target_currency_rate,
        })
    }
}

fn partition_results<T, E>(iterator: impl Iterator<Item = Result<T, E>>) -> (Vec<T>, Vec<E>)
where
    T: std::fmt::Debug,
    E: std::fmt::Debug,
{
    let (oks, errors): (Vec<_>, Vec<_>) = iterator.partition(Result::is_ok);
    let unwrapped_oks: Vec<_> = oks.into_iter().map(Result::unwrap).collect();
    let unwrapped_errors: Vec<_> = errors.into_iter().map(Result::unwrap_err).collect();
    (unwrapped_oks, unwrapped_errors)
}

fn estimate_asset_cost(
    cost_library: &CostLibrary,
    asset: &AssetParameters,
    options: &CostEstimateOptionsInternal,
) -> Result<AssetCostEstimate, CostEstimateError> {
    // Collect cost reference items
    let cost_reference_items: CostReferenceItems<'_> = cost_library
        .modules
        .iter()
        .flat_map(|module| &module.cost_items)
        .map(|cost_ref| (cost_ref.id.as_str(), cost_ref))
        .collect();

    // Map cost items to library items
    let (linked_cost_items, errors) = partition_results(asset.cost_items.iter().map(|cost_item| {
        LinkedCostItem::find_and_link(cost_item, &cost_reference_items, cost_library)
    }));

    // Handle errors linking cost items
    if !errors.is_empty() {
        let combined_error = errors
            .into_iter()
            .reduce(|acc, err| acc.combine(err))
            .unwrap();
        return Err(combined_error);
    }

    let start_year = asset.timeline.start();

    // Produce cost item estimates
    let cost_items: Vec<CostItemCostEstimate> = linked_cost_items
        .iter()
        .map(|item| {
            let costs = item.get_costs(options)?;

            let costs_by_year: Vec<_> = costs
                .spread(&asset.timeline)
                .map(|(year, costs_in_year)| YearCostItemCosts {
                    year,
                    costs_in_year,
                    dcf_costs_in_year: costs_in_year
                        / (1.0 + asset.discount_rate).powi((year - start_year).into()),
                })
                .collect();

            let lifetime_costs = costs_by_year
                .iter()
                .fold(CostItemPeriodCosts::default(), |acc, cost| {
                    acc + cost.costs_in_year
                });

            let lifetime_dcf_costs = costs_by_year
                .iter()
                .fold(CostItemPeriodCosts::default(), |acc, cost| {
                    acc + cost.dcf_costs_in_year
                });

            Ok(CostItemCostEstimate {
                id: item.id.to_string(),
                quantity: item.quantity,
                costs,
                lifetime_costs,
                costs_by_year,
                lifetime_dcf_costs,
            })
        })
        .collect::<Result<Vec<_>, CostEstimateError>>()?;

    // Build the cost values
    let direct_equipment_cost: f64 = cost_items
        .iter()
        .filter_map(|item| item.costs.direct_equipment_cost)
        .sum();
    let lang_factored_capital_cost = LangFactoredCostEstimate {
        equipment_erection: direct_equipment_cost * asset.capex_lang_factors.equipment_erection,
        piping: direct_equipment_cost * asset.capex_lang_factors.piping,
        instrumentation: direct_equipment_cost * asset.capex_lang_factors.instrumentation,
        electrical: direct_equipment_cost * asset.capex_lang_factors.electrical,
        buildings_and_process: direct_equipment_cost
            * asset.capex_lang_factors.buildings_and_process,
        utilities: direct_equipment_cost * asset.capex_lang_factors.utilities,
        storages: direct_equipment_cost * asset.capex_lang_factors.storages,
        site_development: direct_equipment_cost * asset.capex_lang_factors.site_development,
        ancillary_buildings: direct_equipment_cost * asset.capex_lang_factors.ancillary_buildings,
        design_and_engineering: direct_equipment_cost
            * asset.capex_lang_factors.design_and_engineering,
        contractors_fee: direct_equipment_cost * asset.capex_lang_factors.contractors_fee,
        contingency: direct_equipment_cost * asset.capex_lang_factors.contingency,
    };
    let sum_total_installed_cost: f64 = cost_items
        .iter()
        .filter_map(|item| item.costs.total_installed_cost)
        .sum();
    let total_installed_cost = direct_equipment_cost + lang_factored_capital_cost.total()
        - lang_factored_capital_cost.contingency
        + sum_total_installed_cost;
    let fixed_opex_cost_per_year = FixedOpexCostEstimate {
        maintenance: total_installed_cost * asset.opex_factors.maintenance,
        control_room_facilities: total_installed_cost * asset.opex_factors.control_room_facilities,
        insurance_liability: total_installed_cost * asset.opex_factors.insurance_liability,
        insurance_equipment_loss: total_installed_cost
            * asset.opex_factors.insurance_equipment_loss,
        cost_of_capital: total_installed_cost * asset.opex_factors.cost_of_capital,
        major_turnarounds: total_installed_cost * asset.opex_factors.major_turnarounds,
    };
    let variable_opex_cost_per_year = cost_items
        .iter()
        .map(|item| &item.costs.variable_opex_cost_per_year)
        .fold(VariableOpexCostEstimate::default(), |acc, costs| {
            acc + *costs
        });
    let decommissioning_cost = (direct_equipment_cost + lang_factored_capital_cost.total()
        - lang_factored_capital_cost.contingency)
        * 0.1;

    // Spread cost values across years
    let direct_equipment_cost_per_year =
        direct_equipment_cost / asset.timeline.construction_range().len() as f64;
    let total_installed_cost_per_year =
        total_installed_cost / asset.timeline.construction_range().len() as f64;
    let lang_factored_capital_cost_per_year =
        lang_factored_capital_cost / asset.timeline.construction_range().len() as f64;
    let decomissioning_cost_per_year =
        decommissioning_cost / asset.timeline.decommissioning_range().len() as f64;
    let costs_by_year: Vec<YearAssetCosts> = asset
        .timeline
        .range()
        .map(|year| {
            (
                year,
                AssetPeriodCosts {
                    direct_equipment_cost: if asset.timeline.construction_range().contains(&year) {
                        direct_equipment_cost_per_year
                    } else {
                        Default::default()
                    },
                    lang_factored_capital_cost: if asset
                        .timeline
                        .construction_range()
                        .contains(&year)
                    {
                        lang_factored_capital_cost_per_year
                    } else {
                        Default::default()
                    },
                    total_installed_cost: if asset.timeline.construction_range().contains(&year) {
                        total_installed_cost_per_year
                    } else {
                        Default::default()
                    },
                    fixed_opex_cost: if asset.timeline.operation_range().contains(&year) {
                        fixed_opex_cost_per_year
                    } else {
                        Default::default()
                    },
                    variable_opex_cost: if asset.timeline.operation_range().contains(&year) {
                        variable_opex_cost_per_year
                    } else {
                        Default::default()
                    },
                    decommissioning_cost: if asset.timeline.decommissioning_range().contains(&year)
                    {
                        decomissioning_cost_per_year
                    } else {
                        Default::default()
                    },
                },
            )
        })
        .map(|(year, costs_in_year)| {
            let dcf_costs_in_year = costs_in_year
                / (1.0 + asset.discount_rate).powi((year - asset.timeline.start()).into());
            YearAssetCosts {
                year,
                costs_in_year,
                dcf_costs_in_year,
            }
        })
        .collect();

    // Get totals
    let lifetime_costs = costs_by_year
        .iter()
        .map(|year_costs| &year_costs.costs_in_year)
        .fold(Default::default(), |acc, costs| acc + *costs);
    let lifetime_dcf_costs = costs_by_year
        .iter()
        .map(|year_costs| &year_costs.dcf_costs_in_year)
        .fold(Default::default(), |acc, costs| acc + *costs);

    // Build output
    let costs = AssetCosts {
        direct_equipment_cost,
        lang_factored_capital_cost,
        total_installed_cost,
        fixed_opex_cost_per_year,
        variable_opex_cost_per_year,
        decommissioning_cost,
    };

    Ok(AssetCostEstimate {
        id: asset.id.clone(),
        cost_items,
        costs,
        costs_by_year,
        lifetime_costs,
        lifetime_dcf_costs,
    })
}

pub fn estimate_cost<'options>(
    cost_library: &CostLibrary,
    assets: &[AssetParameters],
    options: &CostEstimateOptions<'options>,
) -> CostEstimateResponse {
    let internal_options = match options.convert_to_internal(cost_library) {
        Ok(internal_options) => internal_options,
        Err(err) => return CostEstimateResponse::DataError(Json(err)),
    };

    let asset_cost_estimates = assets
        .iter()
        .map(|asset| estimate_asset_cost(cost_library, asset, &internal_options));
    let (ok_asset_cost_estimates, errors) = partition_results(asset_cost_estimates);

    // Handle errors linking cost items
    if !errors.is_empty() {
        let combined_error = errors
            .into_iter()
            .reduce(|acc, err| acc.combine(err))
            .unwrap();
        return CostEstimateResponse::DataError(Json(combined_error));
    }

    CostEstimateResponse::Ok(Json(CostEstimate {
        assets: ok_asset_cost_estimates,
    }))
}

#[cfg(test)]
mod tests {
    use cost_library::{
        CapexContribution, Cost, CostModule, CostReferenceItem, CostScalingFactor,
        CurrencyConversionRates, DehydrationProperties, InflationRates,
    };

    use crate::route::cost::estimate::{
        request::{
            CapexLangFactors, CostItemParameters, CostParameter, FixedOpexFactors, Timeline,
        },
        response::CostItemCosts,
    };

    use super::*;

    fn create_cost_library() -> CostLibrary {
        let modules = vec![
            CostModule {
                id: "M0101".to_string(),
                definition: cost_library::ModuleDef::Dehydration(DehydrationProperties {}),
                subtype: None,
                cost_items: vec![CostReferenceItem {
                    id: "Item 001".to_string(),
                    info: Default::default(),
                    scaling_factors: vec![
                        CostScalingFactor {
                            name: "length".to_string(),
                            units: "m".to_string(),
                            source_value: 50.0,
                        },
                        CostScalingFactor {
                            name: "depth".to_string(),
                            units: "m".to_string(),
                            source_value: 50.0,
                        },
                    ],
                    capex_contribution: CapexContribution {
                        year: 2024,
                        currency: "GBP".to_string(),
                        cost: Cost::Linear { base_cost: 100.0 },
                    },
                    variable_opex_contributions: vec![],
                }],
            },
            CostModule {
                id: "M0102".to_string(),
                definition: cost_library::ModuleDef::Dehydration(DehydrationProperties {}),
                subtype: None,
                cost_items: vec![CostReferenceItem {
                    id: "Item 002".to_string(),
                    info: Default::default(),
                    scaling_factors: vec![
                        CostScalingFactor {
                            name: "length".to_string(),
                            units: "m".to_string(),
                            source_value: 50.0,
                        },
                        CostScalingFactor {
                            name: "depth".to_string(),
                            units: "m".to_string(),
                            source_value: 50.0,
                        },
                    ],
                    capex_contribution: CapexContribution {
                        year: 2023,
                        currency: "GBP".to_string(),
                        cost: Cost::Linear { base_cost: 100.0 },
                    },
                    variable_opex_contributions: vec![],
                }],
            },
            CostModule {
                id: "M0103".to_string(),
                definition: cost_library::ModuleDef::Dehydration(DehydrationProperties {}),
                subtype: None,
                cost_items: vec![CostReferenceItem {
                    id: "Item 003".to_string(),
                    info: Default::default(),
                    scaling_factors: vec![
                        CostScalingFactor {
                            name: "length".to_string(),
                            units: "m".to_string(),
                            source_value: 50.0,
                        },
                        CostScalingFactor {
                            name: "depth".to_string(),
                            units: "m".to_string(),
                            source_value: 50.0,
                        },
                    ],
                    capex_contribution: CapexContribution {
                        year: 2023,
                        currency: "EUR".to_string(),
                        cost: Cost::Linear { base_cost: 100.0 },
                    },
                    variable_opex_contributions: vec![],
                }],
            },
        ];

        let currency_conversion = CurrencyConversionRates {
            base_currency: "GBP".to_owned(),
            rates: [("GBP".to_owned(), 1.0), ("EUR".to_owned(), 3.0)]
                .into_iter()
                .collect(),
        };

        let inflation = InflationRates {
            current_year: "2024".to_owned(),
            factors: [("2024".to_owned(), 1.0), ("2023".to_owned(), 2.0)]
                .into_iter()
                .collect(),
        };

        CostLibrary {
            modules,
            currency_conversion,
            inflation,
        }
    }

    #[test]
    fn test_can_create_estimate() {
        let estimate = estimate_cost(
            &create_cost_library(),
            &[AssetParameters {
                id: "a1".to_string(),
                timeline: Timeline {
                    construction_start: 2025,
                    construction_finish: 2025,
                    operation_start: 2026,
                    operation_finish: 2026,
                    decommissioning_start: 2027,
                    decommissioning_finish: 2027,
                },
                labour_average_salary: CostParameter {
                    currency_code: "EUR".to_string(),
                    amount: 55000.0,
                },
                fte_personnel: 5.0,
                asset_uptime: 0.95,
                capex_lang_factors: CapexLangFactors::default(),
                opex_factors: FixedOpexFactors::default(),
                discount_rate: 0.1,
                cost_items: vec![CostItemParameters {
                    id: "c1".to_owned(),
                    cost_item_ref: "Item 001".to_owned(),
                    parameters: [("length".to_owned(), 100.0), ("depth".to_owned(), 30.0)]
                        .into_iter()
                        .collect(),
                    quantity: 1,
                }],
            }],
            &CostEstimateOptions {
                target_currency: None,
            },
        );

        let CostEstimateResponse::Ok(Json(estimate)) = estimate else {
            panic!()
        };
        assert_eq!(
            estimate,
            CostEstimate {
                assets: vec![AssetCostEstimate {
                    id: "a1".to_string(),
                    costs: AssetCosts {
                        direct_equipment_cost: 120.0,
                        lang_factored_capital_cost: LangFactoredCostEstimate {
                            equipment_erection: 48.0,
                            piping: 84.0,
                            instrumentation: 24.0,
                            electrical: 12.0,
                            buildings_and_process: 18.0,
                            utilities: 60.0,
                            storages: 18.0,
                            site_development: 6.0,
                            ancillary_buildings: 18.0,
                            design_and_engineering: 36.0,
                            contractors_fee: 6.0,
                            contingency: 120.0
                        },
                        total_installed_cost: 450.0,
                        fixed_opex_cost_per_year: FixedOpexCostEstimate {
                            maintenance: 36.0,
                            control_room_facilities: 0.0,
                            insurance_liability: 0.0,
                            insurance_equipment_loss: 0.0,
                            cost_of_capital: 0.0,
                            major_turnarounds: 0.0
                        },
                        variable_opex_cost_per_year: VariableOpexCostEstimate {
                            electrical_power: 0.0,
                            cooling_water: 0.0,
                            natural_gas: 0.0,
                            steam_hp_superheated: 0.0,
                            steam_lp_saturated: 0.0,
                            catalysts_and_chemicals: 0.0,
                            equipment_item_rental: 0.0,
                            cost_per_tonne_of_co2: 0.0,
                            tariff: 0.0
                        },
                        decommissioning_cost: 45.0
                    },
                    costs_by_year: vec![
                        YearAssetCosts {
                            year: 2025,
                            costs_in_year: AssetPeriodCosts {
                                direct_equipment_cost: 120.0,
                                lang_factored_capital_cost: LangFactoredCostEstimate {
                                    equipment_erection: 48.0,
                                    piping: 84.0,
                                    instrumentation: 24.0,
                                    electrical: 12.0,
                                    buildings_and_process: 18.0,
                                    utilities: 60.0,
                                    storages: 18.0,
                                    site_development: 6.0,
                                    ancillary_buildings: 18.0,
                                    design_and_engineering: 36.0,
                                    contractors_fee: 6.0,
                                    contingency: 120.0
                                },
                                total_installed_cost: 450.0,
                                fixed_opex_cost: FixedOpexCostEstimate {
                                    maintenance: 0.0,
                                    control_room_facilities: 0.0,
                                    insurance_liability: 0.0,
                                    insurance_equipment_loss: 0.0,
                                    cost_of_capital: 0.0,
                                    major_turnarounds: 0.0
                                },
                                variable_opex_cost: VariableOpexCostEstimate {
                                    electrical_power: 0.0,
                                    cooling_water: 0.0,
                                    natural_gas: 0.0,
                                    steam_hp_superheated: 0.0,
                                    steam_lp_saturated: 0.0,
                                    catalysts_and_chemicals: 0.0,
                                    equipment_item_rental: 0.0,
                                    cost_per_tonne_of_co2: 0.0,
                                    tariff: 0.0
                                },
                                decommissioning_cost: 0.0
                            },
                            dcf_costs_in_year: AssetPeriodCosts {
                                direct_equipment_cost: 120.0,
                                lang_factored_capital_cost: LangFactoredCostEstimate {
                                    equipment_erection: 48.0,
                                    piping: 84.0,
                                    instrumentation: 24.0,
                                    electrical: 12.0,
                                    buildings_and_process: 18.0,
                                    utilities: 60.0,
                                    storages: 18.0,
                                    site_development: 6.0,
                                    ancillary_buildings: 18.0,
                                    design_and_engineering: 36.0,
                                    contractors_fee: 6.0,
                                    contingency: 120.0
                                },
                                total_installed_cost: 450.0,
                                fixed_opex_cost: FixedOpexCostEstimate {
                                    maintenance: 0.0,
                                    control_room_facilities: 0.0,
                                    insurance_liability: 0.0,
                                    insurance_equipment_loss: 0.0,
                                    cost_of_capital: 0.0,
                                    major_turnarounds: 0.0
                                },
                                variable_opex_cost: VariableOpexCostEstimate {
                                    electrical_power: 0.0,
                                    cooling_water: 0.0,
                                    natural_gas: 0.0,
                                    steam_hp_superheated: 0.0,
                                    steam_lp_saturated: 0.0,
                                    catalysts_and_chemicals: 0.0,
                                    equipment_item_rental: 0.0,
                                    cost_per_tonne_of_co2: 0.0,
                                    tariff: 0.0
                                },
                                decommissioning_cost: 0.0
                            }
                        },
                        YearAssetCosts {
                            year: 2026,
                            costs_in_year: AssetPeriodCosts {
                                direct_equipment_cost: 0.0,
                                lang_factored_capital_cost: LangFactoredCostEstimate {
                                    equipment_erection: 0.0,
                                    piping: 0.0,
                                    instrumentation: 0.0,
                                    electrical: 0.0,
                                    buildings_and_process: 0.0,
                                    utilities: 0.0,
                                    storages: 0.0,
                                    site_development: 0.0,
                                    ancillary_buildings: 0.0,
                                    design_and_engineering: 0.0,
                                    contractors_fee: 0.0,
                                    contingency: 0.0
                                },
                                total_installed_cost: 0.0,
                                fixed_opex_cost: FixedOpexCostEstimate {
                                    maintenance: 36.0,
                                    control_room_facilities: 0.0,
                                    insurance_liability: 0.0,
                                    insurance_equipment_loss: 0.0,
                                    cost_of_capital: 0.0,
                                    major_turnarounds: 0.0
                                },
                                variable_opex_cost: VariableOpexCostEstimate {
                                    electrical_power: 0.0,
                                    cooling_water: 0.0,
                                    natural_gas: 0.0,
                                    steam_hp_superheated: 0.0,
                                    steam_lp_saturated: 0.0,
                                    catalysts_and_chemicals: 0.0,
                                    equipment_item_rental: 0.0,
                                    cost_per_tonne_of_co2: 0.0,
                                    tariff: 0.0
                                },
                                decommissioning_cost: 0.0
                            },
                            dcf_costs_in_year: AssetPeriodCosts {
                                direct_equipment_cost: 0.0,
                                lang_factored_capital_cost: LangFactoredCostEstimate {
                                    equipment_erection: 0.0,
                                    piping: 0.0,
                                    instrumentation: 0.0,
                                    electrical: 0.0,
                                    buildings_and_process: 0.0,
                                    utilities: 0.0,
                                    storages: 0.0,
                                    site_development: 0.0,
                                    ancillary_buildings: 0.0,
                                    design_and_engineering: 0.0,
                                    contractors_fee: 0.0,
                                    contingency: 0.0
                                },
                                total_installed_cost: 0.0,
                                fixed_opex_cost: FixedOpexCostEstimate {
                                    maintenance: 32.72727272727273,
                                    control_room_facilities: 0.0,
                                    insurance_liability: 0.0,
                                    insurance_equipment_loss: 0.0,
                                    cost_of_capital: 0.0,
                                    major_turnarounds: 0.0
                                },
                                variable_opex_cost: VariableOpexCostEstimate {
                                    electrical_power: 0.0,
                                    cooling_water: 0.0,
                                    natural_gas: 0.0,
                                    steam_hp_superheated: 0.0,
                                    steam_lp_saturated: 0.0,
                                    catalysts_and_chemicals: 0.0,
                                    equipment_item_rental: 0.0,
                                    cost_per_tonne_of_co2: 0.0,
                                    tariff: 0.0
                                },
                                decommissioning_cost: 0.0
                            }
                        },
                        YearAssetCosts {
                            year: 2027,
                            costs_in_year: AssetPeriodCosts {
                                direct_equipment_cost: 0.0,
                                lang_factored_capital_cost: LangFactoredCostEstimate {
                                    equipment_erection: 0.0,
                                    piping: 0.0,
                                    instrumentation: 0.0,
                                    electrical: 0.0,
                                    buildings_and_process: 0.0,
                                    utilities: 0.0,
                                    storages: 0.0,
                                    site_development: 0.0,
                                    ancillary_buildings: 0.0,
                                    design_and_engineering: 0.0,
                                    contractors_fee: 0.0,
                                    contingency: 0.0
                                },
                                total_installed_cost: 0.0,
                                fixed_opex_cost: FixedOpexCostEstimate {
                                    maintenance: 0.0,
                                    control_room_facilities: 0.0,
                                    insurance_liability: 0.0,
                                    insurance_equipment_loss: 0.0,
                                    cost_of_capital: 0.0,
                                    major_turnarounds: 0.0
                                },
                                variable_opex_cost: VariableOpexCostEstimate {
                                    electrical_power: 0.0,
                                    cooling_water: 0.0,
                                    natural_gas: 0.0,
                                    steam_hp_superheated: 0.0,
                                    steam_lp_saturated: 0.0,
                                    catalysts_and_chemicals: 0.0,
                                    equipment_item_rental: 0.0,
                                    cost_per_tonne_of_co2: 0.0,
                                    tariff: 0.0
                                },
                                decommissioning_cost: 45.0
                            },
                            dcf_costs_in_year: AssetPeriodCosts {
                                direct_equipment_cost: 0.0,
                                lang_factored_capital_cost: LangFactoredCostEstimate {
                                    equipment_erection: 0.0,
                                    piping: 0.0,
                                    instrumentation: 0.0,
                                    electrical: 0.0,
                                    buildings_and_process: 0.0,
                                    utilities: 0.0,
                                    storages: 0.0,
                                    site_development: 0.0,
                                    ancillary_buildings: 0.0,
                                    design_and_engineering: 0.0,
                                    contractors_fee: 0.0,
                                    contingency: 0.0
                                },
                                total_installed_cost: 0.0,
                                fixed_opex_cost: FixedOpexCostEstimate {
                                    maintenance: 0.0,
                                    control_room_facilities: 0.0,
                                    insurance_liability: 0.0,
                                    insurance_equipment_loss: 0.0,
                                    cost_of_capital: 0.0,
                                    major_turnarounds: 0.0
                                },
                                variable_opex_cost: VariableOpexCostEstimate {
                                    electrical_power: 0.0,
                                    cooling_water: 0.0,
                                    natural_gas: 0.0,
                                    steam_hp_superheated: 0.0,
                                    steam_lp_saturated: 0.0,
                                    catalysts_and_chemicals: 0.0,
                                    equipment_item_rental: 0.0,
                                    cost_per_tonne_of_co2: 0.0,
                                    tariff: 0.0
                                },
                                decommissioning_cost: 37.19008264462809
                            }
                        }
                    ],
                    lifetime_costs: AssetPeriodCosts {
                        direct_equipment_cost: 120.0,
                        lang_factored_capital_cost: LangFactoredCostEstimate {
                            equipment_erection: 48.0,
                            piping: 84.0,
                            instrumentation: 24.0,
                            electrical: 12.0,
                            buildings_and_process: 18.0,
                            utilities: 60.0,
                            storages: 18.0,
                            site_development: 6.0,
                            ancillary_buildings: 18.0,
                            design_and_engineering: 36.0,
                            contractors_fee: 6.0,
                            contingency: 120.0
                        },
                        total_installed_cost: 450.0,
                        fixed_opex_cost: FixedOpexCostEstimate {
                            maintenance: 36.0,
                            control_room_facilities: 0.0,
                            insurance_liability: 0.0,
                            insurance_equipment_loss: 0.0,
                            cost_of_capital: 0.0,
                            major_turnarounds: 0.0
                        },
                        variable_opex_cost: VariableOpexCostEstimate {
                            electrical_power: 0.0,
                            cooling_water: 0.0,
                            natural_gas: 0.0,
                            steam_hp_superheated: 0.0,
                            steam_lp_saturated: 0.0,
                            catalysts_and_chemicals: 0.0,
                            equipment_item_rental: 0.0,
                            cost_per_tonne_of_co2: 0.0,
                            tariff: 0.0
                        },
                        decommissioning_cost: 45.0
                    },
                    lifetime_dcf_costs: AssetPeriodCosts {
                        direct_equipment_cost: 120.0,
                        lang_factored_capital_cost: LangFactoredCostEstimate {
                            equipment_erection: 48.0,
                            piping: 84.0,
                            instrumentation: 24.0,
                            electrical: 12.0,
                            buildings_and_process: 18.0,
                            utilities: 60.0,
                            storages: 18.0,
                            site_development: 6.0,
                            ancillary_buildings: 18.0,
                            design_and_engineering: 36.0,
                            contractors_fee: 6.0,
                            contingency: 120.0
                        },
                        total_installed_cost: 450.0,
                        fixed_opex_cost: FixedOpexCostEstimate {
                            maintenance: 32.72727272727273,
                            control_room_facilities: 0.0,
                            insurance_liability: 0.0,
                            insurance_equipment_loss: 0.0,
                            cost_of_capital: 0.0,
                            major_turnarounds: 0.0
                        },
                        variable_opex_cost: VariableOpexCostEstimate {
                            electrical_power: 0.0,
                            cooling_water: 0.0,
                            natural_gas: 0.0,
                            steam_hp_superheated: 0.0,
                            steam_lp_saturated: 0.0,
                            catalysts_and_chemicals: 0.0,
                            equipment_item_rental: 0.0,
                            cost_per_tonne_of_co2: 0.0,
                            tariff: 0.0
                        },
                        decommissioning_cost: 37.19008264462809
                    },
                    cost_items: vec![CostItemCostEstimate {
                        id: "c1".to_string(),
                        quantity: 1,
                        costs: CostItemCosts {
                            direct_equipment_cost: Some(120.0),
                            total_installed_cost: None,
                            variable_opex_cost_per_year: VariableOpexCostEstimate {
                                electrical_power: 0.0,
                                cooling_water: 0.0,
                                natural_gas: 0.0,
                                steam_hp_superheated: 0.0,
                                steam_lp_saturated: 0.0,
                                catalysts_and_chemicals: 0.0,
                                equipment_item_rental: 0.0,
                                cost_per_tonne_of_co2: 0.0,
                                tariff: 0.0
                            }
                        },
                        costs_by_year: vec![
                            YearCostItemCosts {
                                year: 2025,
                                costs_in_year: CostItemPeriodCosts {
                                    direct_equipment_cost: Some(120.0),
                                    total_installed_cost: None,
                                    variable_opex_cost: VariableOpexCostEstimate {
                                        electrical_power: 0.0,
                                        cooling_water: 0.0,
                                        natural_gas: 0.0,
                                        steam_hp_superheated: 0.0,
                                        steam_lp_saturated: 0.0,
                                        catalysts_and_chemicals: 0.0,
                                        equipment_item_rental: 0.0,
                                        cost_per_tonne_of_co2: 0.0,
                                        tariff: 0.0
                                    }
                                },
                                dcf_costs_in_year: CostItemPeriodCosts {
                                    direct_equipment_cost: Some(120.0),
                                    total_installed_cost: None,
                                    variable_opex_cost: VariableOpexCostEstimate {
                                        electrical_power: 0.0,
                                        cooling_water: 0.0,
                                        natural_gas: 0.0,
                                        steam_hp_superheated: 0.0,
                                        steam_lp_saturated: 0.0,
                                        catalysts_and_chemicals: 0.0,
                                        equipment_item_rental: 0.0,
                                        cost_per_tonne_of_co2: 0.0,
                                        tariff: 0.0
                                    }
                                }
                            },
                            YearCostItemCosts {
                                year: 2026,
                                costs_in_year: CostItemPeriodCosts {
                                    direct_equipment_cost: None,
                                    total_installed_cost: None,
                                    variable_opex_cost: VariableOpexCostEstimate {
                                        electrical_power: 0.0,
                                        cooling_water: 0.0,
                                        natural_gas: 0.0,
                                        steam_hp_superheated: 0.0,
                                        steam_lp_saturated: 0.0,
                                        catalysts_and_chemicals: 0.0,
                                        equipment_item_rental: 0.0,
                                        cost_per_tonne_of_co2: 0.0,
                                        tariff: 0.0
                                    }
                                },
                                dcf_costs_in_year: CostItemPeriodCosts {
                                    direct_equipment_cost: None,
                                    total_installed_cost: None,
                                    variable_opex_cost: VariableOpexCostEstimate {
                                        electrical_power: 0.0,
                                        cooling_water: 0.0,
                                        natural_gas: 0.0,
                                        steam_hp_superheated: 0.0,
                                        steam_lp_saturated: 0.0,
                                        catalysts_and_chemicals: 0.0,
                                        equipment_item_rental: 0.0,
                                        cost_per_tonne_of_co2: 0.0,
                                        tariff: 0.0
                                    }
                                }
                            },
                            YearCostItemCosts {
                                year: 2027,
                                costs_in_year: CostItemPeriodCosts {
                                    direct_equipment_cost: None,
                                    total_installed_cost: None,
                                    variable_opex_cost: VariableOpexCostEstimate {
                                        electrical_power: 0.0,
                                        cooling_water: 0.0,
                                        natural_gas: 0.0,
                                        steam_hp_superheated: 0.0,
                                        steam_lp_saturated: 0.0,
                                        catalysts_and_chemicals: 0.0,
                                        equipment_item_rental: 0.0,
                                        cost_per_tonne_of_co2: 0.0,
                                        tariff: 0.0
                                    }
                                },
                                dcf_costs_in_year: CostItemPeriodCosts {
                                    direct_equipment_cost: None,
                                    total_installed_cost: None,
                                    variable_opex_cost: VariableOpexCostEstimate {
                                        electrical_power: 0.0,
                                        cooling_water: 0.0,
                                        natural_gas: 0.0,
                                        steam_hp_superheated: 0.0,
                                        steam_lp_saturated: 0.0,
                                        catalysts_and_chemicals: 0.0,
                                        equipment_item_rental: 0.0,
                                        cost_per_tonne_of_co2: 0.0,
                                        tariff: 0.0
                                    }
                                }
                            }
                        ],
                        lifetime_costs: CostItemPeriodCosts {
                            direct_equipment_cost: Some(120.0),
                            total_installed_cost: None,
                            variable_opex_cost: VariableOpexCostEstimate {
                                electrical_power: 0.0,
                                cooling_water: 0.0,
                                natural_gas: 0.0,
                                steam_hp_superheated: 0.0,
                                steam_lp_saturated: 0.0,
                                catalysts_and_chemicals: 0.0,
                                equipment_item_rental: 0.0,
                                cost_per_tonne_of_co2: 0.0,
                                tariff: 0.0
                            }
                        },
                        lifetime_dcf_costs: CostItemPeriodCosts {
                            direct_equipment_cost: Some(120.0),
                            total_installed_cost: None,
                            variable_opex_cost: VariableOpexCostEstimate {
                                electrical_power: 0.0,
                                cooling_water: 0.0,
                                natural_gas: 0.0,
                                steam_hp_superheated: 0.0,
                                steam_lp_saturated: 0.0,
                                catalysts_and_chemicals: 0.0,
                                equipment_item_rental: 0.0,
                                cost_per_tonne_of_co2: 0.0,
                                tariff: 0.0
                            }
                        }
                    }]
                }]
            }
        );
    }
}
