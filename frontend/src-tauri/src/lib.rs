mod commands;
mod server;

use commands::*;
use server::ServerState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      // Initialize local server state
      let server_state = ServerState::new(server::LocalServer::new(3001));
      app.handle().manage(server_state);

      // Auto-start backend server in a background thread
      let app_handle = app.handle().clone();
      std::thread::spawn(move || {
        // Get the backend path (relative to project root)
        let backend_path = std::env::current_dir()
          .ok()
          .and_then(|mut p| {
            // Navigate to backend directory from frontend/src-tauri
            p.pop(); // frontend/src-tauri -> frontend
            p.pop(); // frontend -> project root
            p.push("backend");
            Some(p)
          })
          .unwrap_or_else(|| std::path::PathBuf::from("../backend"));

        // Wait a bit for Tauri to fully initialize
        std::thread::sleep(std::time::Duration::from_millis(1000));

        // Start the server using the app handle
        if let Some(server_state) = app_handle.try_state::<ServerState>() {
          let mut server = server_state.0.lock().unwrap();
          match server.start(backend_path) {
            Ok(()) => {
              // Server process spawned - actual startup will be logged by Bun
              // If Bun fails to bind to the port, the error will appear in stderr
              log::info!("Attempting to start backend server on port 3001...");
            }
            Err(e) => {
              // If it's just that the port is in use, that's fine (server already running)
              if e.contains("already running") || e.contains("already in use") {
                log::info!("Backend server already running on port 3001");
              } else {
                log::error!("Failed to auto-start backend server: {}", e);
              }
            }
          }
        } else {
          log::error!("Failed to access server state for auto-start");
        }
      });

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      start_local_server,
      stop_local_server,
      read_network_directory,
      write_network_file,
      delete_network_file,
      get_operations_config
    ])
    .on_window_event(|_window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        // Stop servers on app close
        // Note: We can't access state here easily, but Drop will handle cleanup
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
