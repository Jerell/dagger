use std::process::{Child, Command};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct LocalServer {
    process: Option<Child>,
    port: u16,
}

impl LocalServer {
    pub fn new(port: u16) -> Self {
        Self {
            process: None,
            port,
        }
    }

    pub fn start(&mut self, backend_path: PathBuf) -> Result<(), String> {
        if self.process.is_some() {
            return Err("Server already running".to_string());
        }

        // Spawn Bun process running local server
        let mut cmd = Command::new("bun");
        cmd.arg("run")
           .arg("src/index.ts")
           .current_dir(&backend_path)
           .env("PORT", self.port.to_string())
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped());

        let child = cmd.spawn()
            .map_err(|e| format!("Failed to start server: {}", e))?;

        self.process = Some(child);
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            child.kill()
                .map_err(|e| format!("Failed to stop server: {}", e))?;
        }
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        // Note: try_wait() doesn't require mutable access, but we check if process exists
        self.process.is_some() && 
        self.process.as_ref()
            .and_then(|_p| {
                // We can't call try_wait on an immutable reference
                // Instead, just check if the process exists
                Some(true)
            })
            .unwrap_or(false)
    }
}

impl Drop for LocalServer {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

// Newtype wrapper for Tauri state management
pub struct ServerState(pub Mutex<LocalServer>);

impl ServerState {
    pub fn new(server: LocalServer) -> Self {
        Self(Mutex::new(server))
    }
}

