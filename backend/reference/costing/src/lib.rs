use std::collections::HashMap;

use cost_library::CostLibrary;
use poem_openapi::{
    OpenApi,
    param::{Path, Query},
    payload::{Json, PlainText},
};

use crate::route::{
    cost::estimate::{
        CostEstimateOptions, CostEstimateRequest, CostEstimateResponse, estimate_cost,
    },
    library::{
        CostLibraryNotFoundError,
        currencies::{ListLibraryCurrenciesResponse, get_currencies},
        modules::{ListLibraryModulesResponse, get_modules},
    },
};

mod route;

pub struct Api {
    cost_libraries: HashMap<&'static str, CostLibrary>,
}

#[macro_export]
macro_rules! get_cost_library {
    ($library_id:expr) => {{
        let data = include_bytes!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/src/data/",
            $library_id,
            "/cost-library.json"
        ));
        serde_json::from_slice(data).unwrap()
    }};
}

impl Default for Api {
    fn default() -> Self {
        let cost_libraries = [
            ("V1.1_working", get_cost_library!("V1.1_working")),
            ("V1.3", get_cost_library!("V1.3")),
            ("V2.0", get_cost_library!("V2.0")),
        ]
        .into_iter()
        .collect();
        Api { cost_libraries }
    }
}

#[OpenApi]
impl Api {
    #[oai(path = "/hello", method = "get")]
    async fn index(&self, name: Query<Option<String>>) -> PlainText<String> {
        match name.0 {
            Some(name) => PlainText(format!("hello, {name}!")),
            None => PlainText("hello!".to_string()),
        }
    }

    #[oai(path = "/library/:library_id/modules", method = "get")]
    async fn list_library_modules(&self, library_id: Path<String>) -> ListLibraryModulesResponse {
        let Some(cost_library) = self.cost_libraries.get(library_id.as_str()) else {
            return ListLibraryModulesResponse::CostLibraryNotFound(Json(
                CostLibraryNotFoundError::new(library_id.as_str()),
            ));
        };
        ListLibraryModulesResponse::Ok(Json(get_modules(cost_library).await))
    }

    #[oai(path = "/library/:library_id/currencies", method = "get")]
    async fn list_library_currencies(
        &self,
        library_id: Path<String>,
    ) -> ListLibraryCurrenciesResponse {
        let Some(cost_library) = self.cost_libraries.get(library_id.as_str()) else {
            return ListLibraryCurrenciesResponse::CostLibraryNotFound(Json(
                CostLibraryNotFoundError::new(library_id.as_str()),
            ));
        };
        ListLibraryCurrenciesResponse::Ok(Json(get_currencies(cost_library).await))
    }

    #[oai(path = "/cost/estimate", method = "post")]
    async fn create_cost_estimate(
        &self,
        request: Json<CostEstimateRequest>,
        library_id: Query<String>,
        target_currency_code: Query<Option<String>>,
    ) -> CostEstimateResponse {
        let Some(cost_library) = self.cost_libraries.get(library_id.as_str()) else {
            return CostEstimateResponse::CostLibraryNotFound(Json(CostLibraryNotFoundError::new(
                library_id.as_str(),
            )));
        };
        let options = CostEstimateOptions {
            target_currency: target_currency_code.as_deref(),
        };
        estimate_cost(cost_library, &request.assets, &options)
    }
}
