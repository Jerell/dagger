use cost_library::{CostLibrary, CostModule};
use poem_openapi::{ApiResponse, payload::Json};

use crate::route::library::CostLibraryNotFoundError;

pub type Modules = Vec<CostModule>;

#[derive(Debug, ApiResponse)]
pub enum ListLibraryModulesResponse {
    #[oai(status = "200")]
    Ok(Json<Modules>),

    #[oai(status = "404")]
    CostLibraryNotFound(Json<CostLibraryNotFoundError>),
}

pub async fn get_modules(cost_library: &CostLibrary) -> Modules {
    cost_library.modules.clone()
}
