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
      app.handle().manage(ServerState::new(server::LocalServer::new(3001)));

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
