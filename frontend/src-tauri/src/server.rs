use std::process::{Child, Command};
use std::path::PathBuf;
use std::sync::Mutex;
use std::net::TcpListener;

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

        // Check if port is already in use (might be from previous session or hot reload)
        // Try to bind to the port - if it fails, the port is already in use
        match TcpListener::bind(format!("127.0.0.1:{}", self.port)) {
            Ok(_) => {
                // Port is available, we can start the server
                // (drop the listener immediately to free the port)
            }
            Err(_) => {
                // Port is in use - assume server is already running from previous instance
                log::info!("Port {} is already in use. Server appears to be running already (likely from hot reload).", self.port);
                return Ok(()); // Don't try to start, just return success
            }
        }

        // Small delay to ensure port is fully released
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Spawn Bun process running local server
        let mut cmd = Command::new("bun");
        cmd.arg("run")
           .arg("src/index.ts")
           .current_dir(&backend_path)
           .env("PORT", self.port.to_string())
           // Inherit stdout/stderr so logs are visible in terminal
           .stdout(std::process::Stdio::inherit())
           .stderr(std::process::Stdio::inherit());

        let child = cmd.spawn()
            .map_err(|e| format!("Failed to start server: {}", e))?;

        self.process = Some(child);
        
        // Note: We can't easily verify the server actually started successfully here
        // because Bun will log errors to stderr. The error will be visible in the terminal.
        // If Bun fails to bind, it will exit and the error will show up in stderr.
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            child.kill()
                .map_err(|e| format!("Failed to stop server: {}", e))?;
        }
        Ok(())
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

