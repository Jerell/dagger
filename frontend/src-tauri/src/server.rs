use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command};
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
        // If we already have a process, stop it first (allows restart)
        if self.process.is_some() {
            log::info!("Stopping existing server process before restart");
            let _ = self.stop();
        }

        // Check if port is already in use
        match TcpListener::bind(format!("127.0.0.1:{}", self.port)) {
            Ok(_) => {
                // Port is available, we can start the server
                // (drop the listener immediately to free the port)
            }
            Err(_) => {
                // Port is in use - try to kill any process using it
                log::warn!("Port {} is in use. Attempting to free it...", self.port);

                // Try to find and kill processes using the port (macOS/Linux)
                #[cfg(unix)]
                {
                    use std::process::Command;
                    let port_arg = format!(":{}", self.port);
                    let output = Command::new("lsof").arg("-ti").arg(&port_arg).output();

                    if let Ok(output) = output {
                        if !output.stdout.is_empty() {
                            let pid_str = String::from_utf8_lossy(&output.stdout);
                            let pid = pid_str.trim();
                            log::info!("Killing process {} using port {}", pid, self.port);
                            let _ = Command::new("kill").arg("-9").arg(pid).output();
                            // Wait a bit for the port to be released
                            std::thread::sleep(std::time::Duration::from_millis(500));
                        }
                    }
                }

                // Try binding again
                match TcpListener::bind(format!("127.0.0.1:{}", self.port)) {
                    Ok(_) => {
                        log::info!("Port {} is now available", self.port);
                    }
                    Err(_) => {
                        return Err(format!("Port {} is still in use after attempting to free it. Please manually stop any process using this port.", self.port));
                    }
                }
            }
        }

        // Small delay to ensure port is fully released
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Spawn Bun process running local server with hot reload
        // Use the "dev" script which runs "tsx watch" for hot reload in development
        let mut cmd = Command::new("bun");
        cmd.arg("run")
            .arg("dev")
            .current_dir(&backend_path)
            .env("PORT", self.port.to_string())
            // Inherit stdout/stderr so logs are visible in terminal
            .stdout(std::process::Stdio::inherit())
            .stderr(std::process::Stdio::inherit());

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start server: {}", e))?;

        self.process = Some(child);

        // Note: We can't easily verify the server actually started successfully here
        // because Bun will log errors to stderr. The error will be visible in the terminal.
        // If Bun fails to bind, it will exit and the error will show up in stderr.
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            child
                .kill()
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
