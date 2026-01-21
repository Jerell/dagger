use cost_library::CostLibrary;
use poem_openapi::{ApiResponse, payload::Json};

use crate::route::library::CostLibraryNotFoundError;

pub type Currencies = Vec<String>;

#[derive(Debug, ApiResponse)]
pub enum ListLibraryCurrenciesResponse {
    #[oai(status = "200")]
    Ok(Json<Currencies>),

    #[oai(status = "404")]
    CostLibraryNotFound(Json<CostLibraryNotFoundError>),
}

pub async fn get_currencies(cost_library: &CostLibrary) -> Currencies {
    cost_library
        .currency_conversion
        .rates
        .keys()
        .cloned()
        .collect()
}
