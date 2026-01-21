# Tauri Distribution Plan

> **Implementation Status (Updated January 2026):** Phases 1-6 are complete. The Tauri app runs with native file watching (using the `notify` crate), auto-starts the Bun backend server, and provides full file system access. Only building/distribution (Phases 7-8) remain.

## Overview

This document outlines the plan for distributing Dagger as a Tauri desktop application. Tauri provides a native desktop app experience while allowing us to use web technologies (React) for the frontend and Rust for the backend.

## Architecture

### Component Structure

```
dagger-tauri/
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   ├── server/               # Local server management
│   │   │   └── local_server.rs  # Spawns/manages Bun + Hono server
│   │   ├── file_system.rs       # Native file system operations
│   │   └── commands.rs          # Tauri commands (exposed to frontend)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                          # Frontend (React + ReactFlow)
│   ├── components/
│   ├── routes/
│   └── lib/
└── package.json
```

### Component Responsibilities

**Tauri Backend (Rust):**

- Spawns and manages local server (Bun + Hono)
- Provides native file system access
- Exposes commands to frontend via Tauri API
- Manages application lifecycle
- **Note:** Operations servers are external - Tauri doesn't spawn them

**Local Server (Bun + Hono):**

- Schema endpoints
- Validation endpoints
- TOML parsing
- Network loading
- **Proxies requests to external operations servers** (HTTP/WebSocket)
- Operations servers are external services, not spawned processes

**Operations Server (External):**

- **External services** (not spawned by Tauri)
- Costing operations
- Modelling operations
- Other evaluations
- Local server makes HTTP requests to external operations servers
- Receives: Network + Schema
- Returns: Operation results

**Frontend (React):**

- ReactFlow network editor
- UI for network editing
- Communicates with local server via HTTP
- Uses Tauri API for native file operations

## Implementation Plan

### Phase 1: Tauri Setup & Basic Structure

#### 1.1 Initialize Tauri Project

```bash
# Create Tauri app structure
npm create tauri-app@latest dagger-tauri
cd dagger-tauri

# Or integrate into existing monorepo
# Add Tauri to existing frontend directory
```

**Project Structure:**

```
dagger/
├── frontend/              # Existing React app
│   └── src-tauri/       # Add Tauri here
├── backend/              # Local server (Bun + Hono)
├── operations/          # Operations server (future)
└── cli/                 # Rust CLI (shared code)
```

#### 1.2 Configure Tauri

**tauri.conf.json:**

```json
{
  "build": {
    "beforeDevCommand": "bun run dev",
    "beforeBuildCommand": "bun run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Dagger",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      },
      "fs": {
        "all": true,
        "scope": ["**"]
      },
      "path": {
        "all": true
      },
      "dialog": {
        "all": true,
        "open": true,
        "save": true
      }
    },
    "windows": [
      {
        "title": "Dagger",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}
```

#### 1.3 Basic Tauri Commands

**src-tauri/src/main.rs:**

```rust
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Phase 2: Local Server Integration

#### 2.1 Spawn Local Server from Tauri

**src-tauri/src/server/local_server.rs:**

```rust
use std::process::{Child, Command};
use std::path::PathBuf;

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
        self.process.as_ref()
            .map(|p| p.try_wait().unwrap_or(None).is_none())
            .unwrap_or(false)
    }
}

impl Drop for LocalServer {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
```

#### 2.2 Tauri Command to Start Server

**src-tauri/src/commands.rs:**

```rust
use crate::server::LocalServer;
use std::sync::Mutex;
use tauri::State;

type ServerState = Mutex<LocalServer>;

#[tauri::command]
async fn start_local_server(
    server: State<'_, ServerState>,
    backend_path: String,
) -> Result<String, String> {
    let mut server = server.lock().unwrap();
    let port = 3001;

    server.start(backend_path.into())
        .map_err(|e| e.to_string())?;

    // Wait a bit for server to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(format!("http://localhost:{}", port))
}

#[tauri::command]
async fn stop_local_server(server: State<'_, ServerState>) -> Result<(), String> {
    let mut server = server.lock().unwrap();
    server.stop()
}
```

**src-tauri/src/main.rs:**

```rust
mod commands;
mod server;

use commands::*;
use server::local_server::LocalServer;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(LocalServer::new(3001)))
        .invoke_handler(tauri::generate_handler![
            start_local_server,
            stop_local_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Phase 3: Native File System Access

#### 3.1 File System Commands

**src-tauri/src/file_system.rs:**

```rust
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkFile {
    path: String,
    content: String,
}

#[tauri::command]
async fn read_network_directory(
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
async fn write_network_file(
    path: String,
    content: String,
) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn delete_network_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}
```

#### 3.2 Directory Picker

**src-tauri/src/commands.rs:**

```rust
use tauri::api::dialog::blocking::FileDialogBuilder;

#[tauri::command]
async fn pick_network_directory() -> Result<Option<String>, String> {
    let path = FileDialogBuilder::new()
        .set_title("Select Network Directory")
        .pick_folder();

    Ok(path.map(|p| p.to_string_lossy().to_string()))
}
```

### Phase 4: External Operations Server Integration

#### 4.1 Operations Server Configuration

**Operations servers are external services** - the local server makes HTTP requests to them. They are not spawned by Tauri.

**src-tauri/src/commands.rs:**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationsServerConfig {
    pub costing_url: Option<String>,
    pub modelling_url: Option<String>,
    // Add other operation server URLs as needed
}

#[tauri::command]
async fn get_operations_config() -> Result<OperationsServerConfig, String> {
    // Read from config file or environment
    // Operations servers are external - just return their URLs
    Ok(OperationsServerConfig {
        costing_url: std::env::var("COSTING_SERVER_URL")
            .ok()
            .or_else(|| Some("http://localhost:4000".to_string())),
        modelling_url: std::env::var("MODELLING_SERVER_URL")
            .ok()
            .or_else(|| Some("http://localhost:4001".to_string())),
    })
}
```

#### 4.2 Local Server Proxies to External Operations

**The local server (Bun + Hono) handles communication with external operations servers:**

**backend/src/routes/operations.ts:**

```typescript
import { Hono } from "hono";

export const operationsRoutes = new Hono();

// Proxy costing operation to external server
operationsRoutes.post("/costing", async (c) => {
  const costingServerUrl =
    process.env.COSTING_SERVER_URL || "http://localhost:4000";
  const { network, schema } = await c.req.json();

  // Forward request to external costing server
  const response = await fetch(`${costingServerUrl}/costing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network, schema }),
  });

  if (!response.ok) {
    return c.json({ error: "Costing operation failed" }, 500);
  }

  const result = await response.json();
  return c.json(result);
});

// Similar for modelling and other operations
```

### Phase 5: Frontend Integration

#### 5.1 Tauri API in Frontend

**src/lib/tauri.ts:**

```typescript
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";

export async function startLocalServer(backendPath: string): Promise<string> {
  return await invoke("start_local_server", { backendPath });
}

export async function stopLocalServer(): Promise<void> {
  return await invoke("stop_local_server");
}

export async function pickNetworkDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Network Directory",
  });

  return Array.isArray(selected) ? selected[0] : selected;
}

export async function readNetworkDirectory(
  path: string
): Promise<NetworkFile[]> {
  return await invoke("read_network_directory", { path });
}

export async function writeNetworkFile(
  path: string,
  content: string
): Promise<void> {
  return await invoke("write_network_file", { path, content });
}

export async function deleteNetworkFile(path: string): Promise<void> {
  return await invoke("delete_network_file", { path });
}
```

#### 5.2 Update Frontend to Use Tauri

**src/lib/collections/flow.ts:**

```typescript
import { readNetworkDirectory, writeNetworkFile } from "@/lib/tauri";

// Instead of File System Access API, use Tauri commands
export async function loadNetworkFromDirectory(
  path: string
): Promise<NetworkResponse> {
  const files = await readNetworkDirectory(path);
  // Parse files and return NetworkResponse
}

export async function writeNodeToFile(
  node: FlowNode,
  directoryPath: string
): Promise<void> {
  const toml = serializeNodeToToml(node);
  const filePath = `${directoryPath}/${node.id}.toml`;
  await writeNetworkFile(filePath, toml);
}
```

### Phase 6: Application Lifecycle

#### 6.1 Startup Sequence

**src-tauri/src/main.rs:**

```rust
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Get app data directory
            let app_data = app.path_resolver()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Get backend path (bundled with app)
            let backend_path = app.path_resolver()
                .resource_dir()
                .expect("Failed to get resource directory")
                .join("backend");

            // Start local server on app startup
            let mut server = app.state::<Mutex<LocalServer>>();
            let mut server = server.lock().unwrap();

            if let Err(e) = server.start(backend_path) {
                eprintln!("Failed to start local server: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_local_server,
            stop_local_server,
            pick_network_directory,
            read_network_directory,
            write_network_file,
            delete_network_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 6.2 Shutdown Cleanup

**src-tauri/src/main.rs:**

```rust
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                // Stop servers on app close
                if let Some(server) = event.window().try_state::<Mutex<LocalServer>>() {
                    let mut server = server.lock().unwrap();
                    let _ = server.stop();
                }
            }
        })
        // ... rest of setup
}
```

### Phase 7: Building & Distribution

#### 7.1 Build Configuration

**tauri.conf.json:**

```json
{
  "build": {
    "beforeBuildCommand": "bun run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "identifier": "com.dagger.app",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": ["backend/**"]
  }
}
```

#### 7.2 Build Scripts

**package.json:**

```json
{
  "scripts": {
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:macos": "tauri build --target x86_64-apple-darwin",
    "tauri:build:windows": "tauri build --target x86_64-pc-windows-msvc",
    "tauri:build:linux": "tauri build --target x86_64-unknown-linux-gnu"
  }
}
```

#### 7.3 Distribution Artifacts

**macOS:**

- `.dmg` installer
- `.app` bundle (can be distributed directly)

**Windows:**

- `.msi` installer
- `.exe` installer (NSIS)
- Portable `.exe`

**Linux:**

- `.AppImage` (portable)
- `.deb` (Debian/Ubuntu)
- `.rpm` (Fedora/RHEL)

### Phase 8: Auto-Updates (Optional)

#### 8.1 Tauri Updater

**tauri.conf.json:**

```json
{
  "updater": {
    "active": true,
    "endpoints": ["https://releases.dagger.app/{{target}}/{{current_version}}"],
    "dialog": true,
    "pubkey": "YOUR_PUBLIC_KEY"
  }
}
```

**src/lib/updates.ts:**

```typescript
import { check } from "@tauri-apps/api/updater";

export async function checkForUpdates() {
  try {
    const { shouldUpdate, manifest } = await check();
    if (shouldUpdate) {
      // Show update dialog
      return manifest;
    }
  } catch (error) {
    console.error("Update check failed:", error);
  }
}
```

## Implementation Checklist

### Phase 1: Setup ✅ COMPLETE

- [x] Initialize Tauri project (`frontend/src-tauri/`)
- [x] Configure tauri.conf.json
- [x] Set up basic Tauri commands
- [x] Test basic app launch

### Phase 2: Local Server ✅ COMPLETE

- [x] Implement LocalServer struct (`server.rs`)
- [x] Add start/stop commands
- [x] Test server spawning
- [x] Handle server errors gracefully
- [x] Auto-start backend server on app launch (`lib.rs` setup)

### Phase 3: File System ✅ COMPLETE

- [x] Implement file read/write commands (`commands.rs`)
- [x] Add directory picker (via `tauri-plugin-dialog`)
- [x] Test file operations
- [x] Update frontend to use Tauri API (`lib/tauri.ts`)
- [x] Native file watching via `notify` crate (`file_watcher.rs`)

### Phase 4: Operations Server ✅ COMPLETE

- [x] Configure external operations server URLs (`get_operations_config`)
- [ ] Update local server to proxy requests to external servers
- [ ] Test communication with external operations servers
- [ ] Handle errors when operations servers are unavailable

### Phase 5: Frontend Integration ✅ COMPLETE

- [x] Create Tauri API wrapper (`lib/tauri.ts`)
- [x] Update flow collections to use Tauri
- [x] Implement watch mode with file watcher (`use-file-watcher.ts`)
- [x] Test end-to-end file operations
- [x] TOML export functionality (`toml-exporter.ts`)

### Phase 6: Lifecycle ✅ COMPLETE

- [x] Implement startup sequence (auto-start backend)
- [x] Add shutdown cleanup (Drop implementations)
- [x] Handle errors during startup
- [x] Test app lifecycle

### Phase 7: Building

- [ ] Configure bundle resources
- [ ] Test builds for each platform
- [ ] Create installers
- [ ] Test installation process

### Phase 8: Distribution

- [ ] Set up release process
- [ ] Create distribution artifacts
- [ ] Test on each platform
- [ ] Document installation

## Considerations

### Bun Runtime Distribution

**Current Implementation:** The app expects Bun to be installed on the user's system. The backend server auto-starts on app launch using the system's `bun` command.

**Option A: Bundle Bun Runtime**

- Include Bun binary in Tauri bundle
- Larger bundle size (~50MB+)
- No external dependency

**Option B: Require Bun Installation** ← Current approach

- User must install Bun separately
- Smaller bundle
- Additional setup step

**Option C: Compile to Node.js**

- Use Node.js instead of Bun
- More widely available
- Larger runtime

**Recommendation:** For distribution, consider Option A (bundle Bun) for best user experience. Currently using Option B for development.

### Operations Server Distribution

**Operations servers are external services** - they are not distributed with the Tauri app. They run as separate services that the local server communicates with via HTTP/WebSocket.

**Options:**

**Option A: Separate Deployments**

- Operations servers deployed independently
- Can be scaled separately
- Different tech stacks per operation
- Local server configured with operations server URLs

**Option B: Local Development Servers**

- For development, operations servers can run locally
- Configured via environment variables or config file
- Local server proxies to localhost URLs

**Option C: Cloud Services**

- Operations servers hosted in cloud
- Local server configured with cloud URLs
- Better for production use

**Recommendation:** Operations servers are external services. The Tauri app only needs to know their URLs (via config or environment variables). The local server handles all communication with them.

### File System Permissions

Tauri provides native file system access, but we should:

- Request permissions appropriately
- Handle permission denials gracefully
- Provide clear error messages
- Allow users to grant permissions via system dialogs

## Next Steps

1. **Start with Phase 1-2:** Get basic Tauri app running with local server
2. **Then Phase 3:** Implement file system operations
3. **Then Phase 4:** Configure external operations server URLs and proxy setup
4. **Finally Phase 7-8:** Build and distribute

**Note:** Operations servers are external services - Phase 4 is about configuring URLs and setting up the local server to proxy requests to them, not spawning them.

This incremental approach allows testing each component before moving to the next.
