use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub struct FileWatcher {
    watcher: Option<RecommendedWatcher>,
    path: Option<PathBuf>,
    app_handle: Option<tauri::AppHandle>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            path: None,
            app_handle: None,
        }
    }

    pub fn start_watching(
        &mut self,
        path: PathBuf,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        // Stop existing watcher if any
        self.stop_watching();

        let (tx, rx) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(move |result: Result<Event, notify::Error>| {
            if let Ok(event) = result {
                if let Err(e) = tx.send(event) {
                    log::error!("Error sending file watch event: {}", e);
                }
            }
        })
        .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        watcher
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        let app_handle_clone = app_handle.clone();
        std::thread::spawn(move || {
            for event in rx {
                if let EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) = event.kind {
                    // Only watch for TOML files
                    let has_toml = event.paths.iter().any(|p| {
                        p.extension()
                            .and_then(|s| s.to_str())
                            .map(|s| s == "toml")
                            .unwrap_or(false)
                    });

                    if has_toml {
                        log::info!("TOML file change detected: {:?}", event.paths);
                        // Emit event to frontend - convert paths to strings
                        let paths: Vec<String> = event.paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();
                        let _ = app_handle_clone.emit("file-changed", paths);
                    }
                }
            }
        });

        self.watcher = Some(watcher);
        self.path = Some(path);
        self.app_handle = Some(app_handle);

        Ok(())
    }

    pub fn stop_watching(&mut self) {
        if let Some(mut watcher) = self.watcher.take() {
            if let Some(path) = &self.path {
                let _ = watcher.unwatch(path);
            }
        }
        self.path = None;
        self.app_handle = None;
    }
}

impl Drop for FileWatcher {
    fn drop(&mut self) {
        self.stop_watching();
    }
}

pub type FileWatcherState = Arc<Mutex<FileWatcher>>;

