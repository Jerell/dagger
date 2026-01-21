use std::{collections::HashMap, ops::RangeInclusive};

use poem_openapi::Object;

pub type Parameters = HashMap<String, f64>;
// Year is an i16 to allow Ranges to be used for various parts of calculations.
// For some reason, RangeInclusive<u32> doesn't implement ExactSizeIterator, so won't work.
pub type Year = i16;

#[derive(Debug, Object)]
pub struct CostEstimateRequest {
    pub assets: Vec<AssetParameters>,
}

#[derive(Debug, Object)]
pub struct AssetParameters {
    pub id: String,

    pub timeline: Timeline,

    /// Labour, average salary
    pub labour_average_salary: CostParameter,
    /// Operations and Maintenance Personnel, FTE
    pub fte_personnel: f64,

    /// Asset uptime
    pub asset_uptime: f64,

    pub capex_lang_factors: CapexLangFactors,
    pub opex_factors: FixedOpexFactors,

    pub cost_items: Vec<CostItemParameters>,

    /// Discount rate, ratio
    pub discount_rate: f64,
}

#[derive(Debug, Object)]
pub struct Timeline {
    /// Year - start construction
    pub construction_start: Year,
    /// Year - finish construction
    pub construction_finish: Year,
    /// Year - start operation
    pub operation_start: Year,
    /// Year - finish operation
    pub operation_finish: Year,
    /// Year - start decommissioning
    pub decommissioning_start: Year,
    /// Year - finish decommissioning
    pub decommissioning_finish: Year,
}

impl Timeline {
    pub fn start(&self) -> Year {
        self.construction_start
    }

    pub fn end(&self) -> Year {
        self.decommissioning_finish
    }

    pub fn range(&self) -> RangeInclusive<Year> {
        self.start()..=self.end()
    }

    pub fn construction_range(&self) -> RangeInclusive<Year> {
        self.construction_start..=self.construction_finish
    }

    pub fn operation_range(&self) -> RangeInclusive<Year> {
        self.operation_start..=self.operation_finish
    }

    pub fn decommissioning_range(&self) -> RangeInclusive<Year> {
        self.decommissioning_start..=self.decommissioning_finish
    }
}

#[derive(Debug, Object)]
pub struct CostParameter {
    pub currency_code: String,
    pub amount: f64,
}

#[derive(Debug, Object)]
pub struct CapexLangFactors {
    /// Equipment erection, portion of CAPEX
    pub equipment_erection: f64,
    /// Piping, portion of CAPEX
    pub piping: f64,
    /// Instrumentation, portion of CAPEX
    pub instrumentation: f64,
    /// Electrical, portion of CAPEX
    pub electrical: f64,
    /// Buildings, process, portion of CAPEX
    pub buildings_and_process: f64,
    /// Utilities, portion of CAPEX
    pub utilities: f64,
    /// Storages, portion of CAPEX
    pub storages: f64,
    /// Site development, portion of CAPEX
    pub site_development: f64,
    /// Ancillary buildings, portion of CAPEX
    pub ancillary_buildings: f64,
    /// Design and Engineering, portion of CAPEX
    pub design_and_engineering: f64,
    /// Contractors's fee (profit), portion of CAPEX
    pub contractors_fee: f64,
    /// Contingency, portion of CAPEX
    pub contingency: f64,
}

impl Default for CapexLangFactors {
    fn default() -> Self {
        Self {
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
        }
    }
}

#[derive(Debug, Object)]
pub struct FixedOpexFactors {
    /// Maintenance - all parts and equipment, portion of CAPEX
    pub maintenance: f64,
    /// Control room facilities, portion of CAPEX
    pub control_room_facilities: f64,
    /// Insurance (liability), portion of CAPEX
    pub insurance_liability: f64,
    /// Insurance (loss of equipment), portion of CAPEX
    pub insurance_equipment_loss: f64,
    /// Cost of capital (excluded from base case), portion of CAPEX
    pub cost_of_capital: f64,
    /// Major turnarounds - 4 year interval (initial assumption that this cost is evenly distributed), portion of CAPEX
    pub major_turnarounds: f64,
}

impl Default for FixedOpexFactors {
    fn default() -> Self {
        Self {
            maintenance: 0.08,
            control_room_facilities: 0.0,
            insurance_liability: 0.0,
            insurance_equipment_loss: 0.0,
            cost_of_capital: 0.0,
            major_turnarounds: 0.0,
        }
    }
}

#[derive(Debug, Object)]
pub struct CostItemParameters {
    pub id: String,
    #[oai(rename = "ref")]
    pub cost_item_ref: String,
    pub quantity: u32,
    pub parameters: Parameters,
}
