use derive_more::{Add, Div, Mul};
use poem_openapi::{ApiResponse, Object, Union, payload::Json};

use crate::route::{
    cost::estimate::request::{Timeline, Year},
    library::CostLibraryNotFoundError,
};

fn add_options<T>(a: Option<T>, b: Option<T>) -> Option<T>
where
    T: std::ops::Add<T, Output = T>,
{
    match (a, b) {
        (Some(a), Some(b)) => Some(a + b),
        (Some(v), _) | (_, Some(v)) => Some(v),
        (None, None) => None,
    }
}

#[derive(Debug, ApiResponse)]
pub enum CostEstimateResponse {
    #[oai(status = "200")]
    Ok(Json<CostEstimate>),

    #[oai(status = "400")]
    DataError(Json<CostEstimateError>),

    #[oai(status = "404")]
    CostLibraryNotFound(Json<CostLibraryNotFoundError>),
}

#[derive(Debug, Object, PartialEq)]
pub struct CostEstimate {
    pub assets: Vec<AssetCostEstimate>,
}

#[derive(Debug, Object, PartialEq)]
pub struct AssetCostEstimate {
    pub id: String,

    pub costs: AssetCosts,
    pub costs_by_year: Vec<YearAssetCosts>,
    /// Total cost over the lifetime of this asset
    pub lifetime_costs: AssetPeriodCosts,
    /// Total cost over the lifetime of this asset, with the Discounted Cash Flow factor applied
    pub lifetime_dcf_costs: AssetPeriodCosts,

    pub cost_items: Vec<CostItemCostEstimate>,
}

#[derive(Debug, Object, PartialEq)]
pub struct CostItemCostEstimate {
    pub id: String,

    pub quantity: u32,

    pub costs: CostItemCosts,
    pub costs_by_year: Vec<YearCostItemCosts>,
    /// Total cost over the lifetime of this cost item
    pub lifetime_costs: CostItemPeriodCosts,
    /// Total cost over the lifetime of this costr item, with the Discounted Cash Flow factor applied
    pub lifetime_dcf_costs: CostItemPeriodCosts,
}

#[derive(Debug, Object, PartialEq)]
pub struct YearAssetCosts {
    pub year: Year,

    /// Costs due for an asset in the given year
    pub costs_in_year: AssetPeriodCosts,
    /// Costs due for an asset in the given year, with the Discounted Cash Flow factor applied
    pub dcf_costs_in_year: AssetPeriodCosts,
}

#[derive(Debug, Object, PartialEq)]
pub struct YearCostItemCosts {
    pub year: Year,

    /// Costs due for an asset in the given year
    pub costs_in_year: CostItemPeriodCosts,
    /// Costs due for an asset in the given year, with the Discounted Cash Flow factor applied
    pub dcf_costs_in_year: CostItemPeriodCosts,
}

#[derive(Debug, Object, PartialEq, Add)]
pub struct AssetCosts {
    pub direct_equipment_cost: f64,
    pub lang_factored_capital_cost: LangFactoredCostEstimate,
    pub total_installed_cost: f64,
    pub fixed_opex_cost_per_year: FixedOpexCostEstimate,
    pub variable_opex_cost_per_year: VariableOpexCostEstimate,
    pub decommissioning_cost: f64,
}

#[derive(Debug, Object, PartialEq, Default, Clone, Copy, Mul, Div, Add)]
pub struct AssetPeriodCosts {
    pub direct_equipment_cost: f64,
    pub lang_factored_capital_cost: LangFactoredCostEstimate,
    pub total_installed_cost: f64,
    pub fixed_opex_cost: FixedOpexCostEstimate,
    pub variable_opex_cost: VariableOpexCostEstimate,
    pub decommissioning_cost: f64,
}

#[derive(Debug, Object, PartialEq, Default, Clone, Copy)]
pub struct CostItemCosts {
    pub direct_equipment_cost: Option<f64>,
    pub total_installed_cost: Option<f64>,
    pub variable_opex_cost_per_year: VariableOpexCostEstimate,
}

#[derive(Debug, Object, PartialEq, Default, Clone, Copy)]
pub struct CostItemPeriodCosts {
    pub direct_equipment_cost: Option<f64>,
    pub total_installed_cost: Option<f64>,
    pub variable_opex_cost: VariableOpexCostEstimate,
}

impl std::ops::Div<f64> for CostItemPeriodCosts {
    type Output = Self;

    fn div(self, rhs: f64) -> Self::Output {
        CostItemPeriodCosts {
            direct_equipment_cost: self.direct_equipment_cost.map(|v| v / rhs),
            total_installed_cost: self.total_installed_cost.map(|v| v / rhs),
            variable_opex_cost: self.variable_opex_cost / rhs,
        }
    }
}

impl std::ops::Add<CostItemPeriodCosts> for CostItemPeriodCosts {
    type Output = Self;

    fn add(self, rhs: CostItemPeriodCosts) -> Self::Output {
        CostItemPeriodCosts {
            direct_equipment_cost: add_options(
                self.direct_equipment_cost,
                rhs.direct_equipment_cost,
            ),
            total_installed_cost: add_options(self.total_installed_cost, rhs.total_installed_cost),
            variable_opex_cost: self.variable_opex_cost + rhs.variable_opex_cost,
        }
    }
}

impl CostItemCosts {
    pub fn spread(&self, timeline: &Timeline) -> impl Iterator<Item = (Year, CostItemPeriodCosts)> {
        let construction_range = timeline.construction_range();
        let direct_equipment_cost_per_year = self
            .direct_equipment_cost
            .map(|v| v / construction_range.len() as f64);
        let total_installed_cost_per_year = self
            .total_installed_cost
            .map(|v| v / construction_range.len() as f64);
        let operation_range = timeline.operation_range();
        let operation_year_cost = &self.variable_opex_cost_per_year;

        let whole_range = timeline.start()..=timeline.end();
        whole_range.map(move |year| {
            let cost = CostItemPeriodCosts {
                direct_equipment_cost: construction_range
                    .contains(&year)
                    .then_some(direct_equipment_cost_per_year)
                    .flatten(),
                total_installed_cost: construction_range
                    .contains(&year)
                    .then_some(total_installed_cost_per_year)
                    .flatten(),
                variable_opex_cost: if operation_range.contains(&year) {
                    *operation_year_cost
                } else {
                    Default::default()
                },
            };
            (year, cost)
        })
    }
}

#[derive(Debug, Object, PartialEq, Clone, Copy, Default, Mul, Add, Div)]
pub struct LangFactoredCostEstimate {
    /// Equipment erection
    pub equipment_erection: f64,
    /// Piping
    pub piping: f64,
    /// Instrumentation
    pub instrumentation: f64,
    /// Electrical
    pub electrical: f64,
    /// Buildings, process
    pub buildings_and_process: f64,
    /// Utilities
    pub utilities: f64,
    /// Storages
    pub storages: f64,
    /// Site development
    pub site_development: f64,
    /// Ancillary buildings
    pub ancillary_buildings: f64,
    /// Design and Engineering
    pub design_and_engineering: f64,
    /// Contractors's fee (profit)
    pub contractors_fee: f64,
    /// Contingency
    pub contingency: f64,
}

impl LangFactoredCostEstimate {
    pub fn total(&self) -> f64 {
        self.equipment_erection
            + self.piping
            + self.instrumentation
            + self.electrical
            + self.buildings_and_process
            + self.utilities
            + self.storages
            + self.site_development
            + self.ancillary_buildings
            + self.design_and_engineering
            + self.contractors_fee
            + self.contingency
    }
}

#[derive(Debug, Object, PartialEq, Clone, Copy, Default, Mul, Add, Div)]
pub struct FixedOpexCostEstimate {
    /// Maintenance - all parts and equipment
    pub maintenance: f64,
    /// Control room facilities
    pub control_room_facilities: f64,
    /// Insurance (liability)
    pub insurance_liability: f64,
    /// Insurance (loss of equipment)
    pub insurance_equipment_loss: f64,
    /// Cost of capital (excluded from base case)
    pub cost_of_capital: f64,
    /// Major turnarounds - 4 year interval (initial assumption that this cost is evenly distributed)
    pub major_turnarounds: f64,
}

#[derive(Debug, Object, PartialEq, Clone, Copy, Default, Mul, Add, Div)]
pub struct VariableOpexCostEstimate {
    /// Electrical power
    pub electrical_power: f64,
    /// Cooling water (10degC temp rise)
    pub cooling_water: f64,
    /// Natural gas
    pub natural_gas: f64,
    /// Steam HP superheat, 600degC and 50bara
    pub steam_hp_superheated: f64,
    /// Steam LP saturated, 160degC and 6.2bara
    pub steam_lp_saturated: f64,
    /// Catalysts and chemicals
    pub catalysts_and_chemicals: f64,
    /// Equipment item rental
    pub equipment_item_rental: f64,
    /// Cost per tonne of CO2
    pub cost_per_tonne_of_co2: f64,
    /// Tariff paid to storage reservoir owner $/tonne CO2
    pub tariff: f64,
}

impl VariableOpexCostEstimate {
    pub fn total(&self) -> f64 {
        self.electrical_power
            + self.cooling_water
            + self.natural_gas
            + self.steam_hp_superheated
            + self.steam_lp_saturated
            + self.catalysts_and_chemicals
            + self.equipment_item_rental
            + self.cost_per_tonne_of_co2
            + self.tariff
    }
}

#[derive(Debug, Union, PartialEq)]
#[oai(discriminator_name = "type")]
pub enum CostEstimateError {
    MissingProperties(CostEstimateErrorMissingProperties),
    UnknownCostItem(CostEstimateErrorUnknownCostItem),
    UnknownCurrencyConversion(CostEstimateErrorUnknownCurrencyConversion),
    UnknownInflationFactor(CostEstimateErrorUnknownInflationFactor),
}

impl CostEstimateError {
    pub fn combine(self, other: CostEstimateError) -> CostEstimateError {
        match (self, other) {
            (CostEstimateError::MissingProperties(a), CostEstimateError::MissingProperties(b)) => {
                CostEstimateError::MissingProperties(a.combine(b))
            }
            (_, CostEstimateError::UnknownCostItem(a))
            | (CostEstimateError::UnknownCostItem(a), _) => CostEstimateError::UnknownCostItem(a),
            (_, CostEstimateError::UnknownCurrencyConversion(a))
            | (CostEstimateError::UnknownCurrencyConversion(a), _) => {
                CostEstimateError::UnknownCurrencyConversion(a)
            }
            (_, CostEstimateError::UnknownInflationFactor(a))
            | (CostEstimateError::UnknownInflationFactor(a), _) => {
                CostEstimateError::UnknownInflationFactor(a)
            }
        }
    }
}

#[derive(Debug, Object, PartialEq)]
pub struct CostEstimateErrorMissingProperties {
    pub properties: Vec<MissingProperty>,
}

impl CostEstimateErrorMissingProperties {
    fn combine(
        self,
        other: CostEstimateErrorMissingProperties,
    ) -> CostEstimateErrorMissingProperties {
        let mut properties = self.properties;
        properties.extend(other.properties);
        CostEstimateErrorMissingProperties { properties }
    }
}

#[derive(Debug, Object, PartialEq)]
pub struct MissingProperty {
    pub id: String,
    pub property: String,
}

#[derive(Debug, Object, PartialEq)]
pub struct CostEstimateErrorUnknownCostItem {
    pub id: String,
}

#[derive(Debug, Object, PartialEq)]
pub struct CostEstimateErrorUnknownCurrencyConversion {
    pub currency: String,
}

#[derive(Debug, Object, PartialEq)]
pub struct CostEstimateErrorUnknownInflationFactor {
    pub year: String,
}
