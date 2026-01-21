use poem_openapi::Object;

pub mod currencies;
pub mod modules;

#[derive(Debug, Object)]
pub struct CostLibraryNotFoundError {
    library_id: String,
}

impl CostLibraryNotFoundError {
    pub fn new(library_id: impl Into<String>) -> Self {
        CostLibraryNotFoundError {
            library_id: library_id.into(),
        }
    }
}
