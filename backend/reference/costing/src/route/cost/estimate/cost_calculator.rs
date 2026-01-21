use std::ops::{Add, Mul};

use crate::route::cost::estimate::CostEstimateOptionsInternal;
use crate::route::cost::estimate::request::Parameters;
use crate::route::cost::estimate::response::{
    CostEstimateError, CostEstimateErrorUnknownCurrencyConversion,
    CostEstimateErrorUnknownInflationFactor, VariableOpexCostEstimate,
};
use cost_library::{CostLibrary, CostReferenceItem, CostReferenceItemCostType};

// Temporary until global params are implemented.
const YEAR_COUNT: f64 = 20.0;
pub trait CostCalculator {
    fn calculate_variable_opex_cost_item(
        &self,
        cost_reference_item: &CostReferenceItem,
        parameters: &Parameters,
        item: &str,
        cost_per_unit: f64,
        options: &CostEstimateOptionsInternal,
    ) -> Result<Option<f64>, CostEstimateError>;

    fn calculate_direct_equipment_cost(
        &self,
        cost_reference_item: &CostReferenceItem,
        parameters: &Parameters,
        options: &CostEstimateOptionsInternal,
    ) -> Result<Option<f64>, CostEstimateError> {
        if cost_reference_item.info.cost_type.unwrap_or_default()
            == CostReferenceItemCostType::DirectEquipmentCost
        {
            Ok(self.calculate_capex_cost(cost_reference_item, parameters, options)?)
        } else {
            Ok(None)
        }
    }

    fn calculate_total_installed_cost(
        &self,
        cost_reference_item: &CostReferenceItem,
        parameters: &Parameters,
        options: &CostEstimateOptionsInternal,
    ) -> Result<Option<f64>, CostEstimateError> {
        if cost_reference_item.info.cost_type.unwrap_or_default()
            == CostReferenceItemCostType::TotalInstalledCost
        {
            Ok(self.calculate_capex_cost(cost_reference_item, parameters, options)?)
        } else {
            Ok(None)
        }
    }

    fn calculate_capex_cost(
        &self,
        cost_reference_item: &CostReferenceItem,
        parameters: &Parameters,
        options: &CostEstimateOptionsInternal,
    ) -> Result<Option<f64>, CostEstimateError>;

    fn calculate_variable_opex_cost(
        &self,
        cost_reference_item: &CostReferenceItem,
        parameters: &Parameters,
        options: &CostEstimateOptionsInternal,
    ) -> Result<VariableOpexCostEstimate, CostEstimateError> {
        // 95% operational uptime
        const OPERATIONAL_HOURS_PER_YEAR: f64 = 24.0 * 365.0 * 0.95;

        Ok(VariableOpexCostEstimate {
            electrical_power: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Electrical power",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            cooling_water: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Cooling water (10degC temp rise)",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            natural_gas: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Natural gas",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            steam_hp_superheated: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Steam HP superheat, 600degC and 50bara",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            steam_lp_saturated: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Steam LP saturated, 160degC and 6.2bara",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            catalysts_and_chemicals: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Catalysts and chemicals",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            equipment_item_rental: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Equipment item rental",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            cost_per_tonne_of_co2: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Cost per tonne of CO2",
                    0.4 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
            tariff: self
                .calculate_variable_opex_cost_item(
                    cost_reference_item,
                    parameters,
                    "Tariff paid to storage reservoir owner",
                    20.0 * OPERATIONAL_HOURS_PER_YEAR,
                    options,
                )?
                .unwrap_or(0.0),
        })
    }
}

impl CostCalculator for CostLibrary {
    fn calculate_capex_cost(
        &self,
        cost_reference_item: &CostReferenceItem,
        parameters: &Parameters,
        options: &CostEstimateOptionsInternal,
    ) -> Result<Option<f64>, CostEstimateError> {
        let cost = match &cost_reference_item.capex_contribution.cost {
            cost_library::Cost::Linear { base_cost } => {
                let scale_factor = cost_reference_item
                    .scaling_factors
                    .iter()
                    .map(|factor| Some(parameters.get(&factor.name)? / factor.source_value))
                    .reduce(product_or_none)
                    .unwrap_or(Some(1.0))
                    .expect("Linear cost could not be calculated (likely because a parameter wasn't provided)");
                base_cost * scale_factor
            }
            cost_library::Cost::Polynomial { parameters: parts } => parts
                .iter()
                .map(|part| match part {
                    cost_library::PolynomialPart::Variable {
                        dimension_name,
                        coefficient,
                        exponent,
                    } => {
                        let value = parameters.get(dimension_name)?;
                        Some(coefficient * value * *exponent)
                    }
                    cost_library::PolynomialPart::Constant { value } => Some(*value),
                })
                .reduce(sum_or_none)
                .unwrap_or(Some(0.0))
                .expect("Polynomial cost could not be calculated (likely because a parameter wasn't provided)"),
        };

        let conversion_factor = get_currency_factor(
            self,
            &cost_reference_item.capex_contribution.currency,
            options,
        )?;
        let inflation_factor = get_inflation_factor(
            self,
            &cost_reference_item.capex_contribution.year.to_string(),
        )?;

        Ok(Some(cost * conversion_factor * inflation_factor))
    }

    fn calculate_variable_opex_cost_item(
        &self,
        cost_reference_item: &CostReferenceItem,
        parameters: &Parameters,
        item: &str,
        cost_per_unit: f64,
        options: &CostEstimateOptionsInternal,
    ) -> Result<Option<f64>, CostEstimateError> {
        let variable_opex_contribution = cost_reference_item
            .variable_opex_contributions
            .iter()
            .find(|voc| voc.name == item);
        let Some(variable_opex_contribution) = variable_opex_contribution else {
            return Ok(None);
        };
        let Some(value) = parameters.get(item) else {
            return Ok(None);
        };

        let conversion_factor = get_currency_factor(
            self,
            &cost_reference_item.capex_contribution.currency,
            options,
        )?;
        let inflation_factor = get_inflation_factor(
            self,
            &cost_reference_item.capex_contribution.year.to_string(),
        )?;

        Ok(Some(
            value
                * variable_opex_contribution.scaled_by
                * cost_per_unit
                * conversion_factor
                * inflation_factor
                * YEAR_COUNT,
        ))
    }
}

fn get_currency_factor(
    cost_library: &CostLibrary,
    currency: &str,
    options: &CostEstimateOptionsInternal,
) -> Result<f64, CostEstimateError> {
    cost_library
        .currency_conversion
        .rates
        .get(currency)
        .copied()
        .map(|rate| rate * options.target_currency_rate)
        .ok_or_else(|| {
            CostEstimateError::UnknownCurrencyConversion(
                CostEstimateErrorUnknownCurrencyConversion {
                    currency: currency.to_string(),
                },
            )
        })
}

fn get_inflation_factor(cost_library: &CostLibrary, year: &str) -> Result<f64, CostEstimateError> {
    cost_library
        .inflation
        .factors
        .get(year)
        .copied()
        .ok_or_else(|| {
            CostEstimateError::UnknownInflationFactor(CostEstimateErrorUnknownInflationFactor {
                year: year.to_string(),
            })
        })
}

fn product_or_none<T>(acc: Option<T>, next: Option<T>) -> Option<T>
where
    T: Mul<T, Output = T>,
{
    acc.zip(next).map(|(acc, next)| acc * next)
}

fn sum_or_none<T>(acc: Option<T>, next: Option<T>) -> Option<T>
where
    T: Add<T, Output = T>,
{
    acc.zip(next).map(|(acc, next)| acc + next)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load_cost_library_v1_1() -> CostLibrary {
        crate::get_cost_library!("V1.1_working")
    }

    #[test]
    fn test_get_inflation_factor_for_known_year() {
        let cost_library = load_cost_library_v1_1();
        let inflation_factor = get_inflation_factor(&cost_library, "2023");
        assert_eq!(inflation_factor, Ok(1.2345478204293925));
    }

    #[test]
    fn test_get_inflation_factor_for_unknown_year() {
        let cost_library = load_cost_library_v1_1();
        let inflation_factor = get_inflation_factor(&cost_library, "1066");
        assert_eq!(
            inflation_factor,
            Err(CostEstimateError::UnknownInflationFactor(
                CostEstimateErrorUnknownInflationFactor {
                    year: "1066".to_string()
                }
            ))
        );
    }

    #[test]
    fn test_get_currency_factor_for_known_currency() {
        let cost_library = load_cost_library_v1_1();
        let currency_factor = get_currency_factor(
            &cost_library,
            "GBP",
            &CostEstimateOptionsInternal {
                target_currency_rate: 0.7,
            },
        );
        assert_eq!(currency_factor, Ok(0.8049999999999999));
    }

    #[test]
    fn test_get_currency_factor_for_unknown_source_currency() {
        let cost_library = load_cost_library_v1_1();
        let currency_factor = get_currency_factor(
            &cost_library,
            "KHR",
            &CostEstimateOptionsInternal {
                target_currency_rate: 0.7,
            },
        );
        assert_eq!(
            currency_factor,
            Err(CostEstimateError::UnknownCurrencyConversion(
                CostEstimateErrorUnknownCurrencyConversion {
                    currency: "KHR".to_string()
                }
            ))
        );
    }

    #[test]
    fn test_calculate_variable_opex_cost() {
        let cost_library = load_cost_library_v1_1();
        let cost_reference_item = cost_library
            .modules
            .iter()
            .flat_map(|module| &module.cost_items)
            .find(|cost_item| cost_item.id == "Item 074")
            .unwrap();
        let parameters = [
            ("Electrical power".to_string(), 20.0),
            ("Thermal Duty".to_string(), 0.1),
        ]
        .into_iter()
        .collect();
        let options = CostEstimateOptionsInternal {
            target_currency_rate: 0.7,
        };
        let variable_opex_cost =
            cost_library.calculate_variable_opex_cost(cost_reference_item, &parameters, &options);
        assert_eq!(
            variable_opex_cost,
            Ok(VariableOpexCostEstimate {
                electrical_power: 1180083.7845152747,
                cooling_water: 0.0,
                natural_gas: 0.0,
                steam_hp_superheated: 0.0,
                steam_lp_saturated: 0.0,
                catalysts_and_chemicals: 0.0,
                equipment_item_rental: 0.0,
                cost_per_tonne_of_co2: 0.0,
                tariff: 0.0
            })
        )
    }

    #[test]
    fn test_calculate_direct_equipment_cost_linear() {
        let cost_library = load_cost_library_v1_1();
        let cost_reference_item = cost_library
            .modules
            .iter()
            .flat_map(|module| &module.cost_items)
            .find(|cost_item| cost_item.id == "Item 074")
            .unwrap();
        let parameters = [("Captured CO2".to_string(), 20.0)].into_iter().collect();
        let options = CostEstimateOptionsInternal {
            target_currency_rate: 0.7,
        };
        let capex_cost = cost_library.calculate_direct_equipment_cost(
            cost_reference_item,
            &parameters,
            &options,
        );
        assert_eq!(capex_cost, Ok(Some(23654191.663114145)))
    }

    #[test]
    fn test_calculate_direct_equipment_cost_polynomial() {
        let cost_library = load_cost_library_v1_1();
        let cost_reference_item = cost_library
            .modules
            .iter()
            .flat_map(|module| &module.cost_items)
            .find(|cost_item| cost_item.id == "Item 058")
            .unwrap();
        let parameters = [("length".to_string(), 20.0)].into_iter().collect();
        let options = CostEstimateOptionsInternal {
            target_currency_rate: 0.7,
        };
        let capex_cost = cost_library.calculate_direct_equipment_cost(
            cost_reference_item,
            &parameters,
            &options,
        );
        assert_eq!(capex_cost, Ok(Some(42508696.705307305)))
    }
}
