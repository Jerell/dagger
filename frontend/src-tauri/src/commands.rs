use crate::server::ServerState;
use crate::file_watcher::FileWatcherState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{State, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkFile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationsServerConfig {
    pub costing_url: Option<String>,
    pub modelling_url: Option<String>,
}

#[tauri::command]
pub async fn start_local_server(
    server: State<'_, ServerState>,
    backend_path: String,
) -> Result<String, String> {
    let port = 3001;
    
    {
        let mut server = server.0.lock().unwrap();
        server.start(backend_path.into())
            .map_err(|e| e.to_string())?;
    } // Drop lock before await

    // Wait a bit for server to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(format!("http://localhost:{}", port))
}

#[tauri::command]
pub async fn stop_local_server(server: State<'_, ServerState>) -> Result<(), String> {
    let mut server = server.0.lock().unwrap();
    server.stop()
}

#[tauri::command]
pub async fn read_network_directory(
    path: String,
) -> Result<Vec<NetworkFile>, String> {
    let dir = PathBuf::from(&path);

    if !dir.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut files = Vec::new();

    for entry in fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("toml") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            files.push(NetworkFile {
                path: path.to_string_lossy().to_string(),
                content,
            });
        }
    }

    Ok(files)
}

#[tauri::command]
pub async fn write_network_file(
    path: String,
    content: String,
) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_network_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_operations_config() -> Result<OperationsServerConfig, String> {
    // Read from environment variables or config file
    // For now, return defaults
    Ok(OperationsServerConfig {
        costing_url: std::env::var("COSTING_SERVER_URL")
            .ok()
            .or_else(|| Some("http://localhost:4000".to_string())),
        modelling_url: std::env::var("MODELLING_SERVER_URL")
            .ok()
            .or_else(|| Some("http://localhost:4001".to_string())),
    })
}

#[tauri::command]
pub async fn start_watching_directory(
    watcher: State<'_, FileWatcherState>,
    path: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let mut watcher_guard = watcher.lock().unwrap();
    watcher_guard.start_watching(path.into(), app)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_watching_directory(
    watcher: State<'_, FileWatcherState>,
) -> Result<(), String> {
    let mut watcher_guard = watcher.lock().unwrap();
    watcher_guard.stop_watching();
    Ok(())
}

