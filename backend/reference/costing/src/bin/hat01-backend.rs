use hat01_costing_tool::Api;
use poem::{EndpointExt, Route, listener::TcpListener, middleware::Cors};
use poem_openapi::OpenApiService;

#[tokio::main]
async fn main() -> Result<(), std::io::Error> {
    let api_service = OpenApiService::new(Api::default(), "Hello World", "1.0")
        .server("http://localhost:8080/api");

    let cors = Cors::new();

    let ui = api_service.swagger_ui();
    let app = Route::new()
        .nest("/api", api_service)
        .nest("/", ui)
        .with(cors);

    println!("Running on http://0.0.0.0:8080");
    poem::Server::new(TcpListener::bind("0.0.0.0:8080"))
        .run(app)
        .await
}
