use hat01_costing_tool::Api;
use poem_openapi::OpenApiService;

fn main() {
    let api_service = OpenApiService::new(Api::default(), "Hello World", "1.0")
        .server("http://localhost:8080/api");
    println!("{}", api_service.spec_yaml());
}
