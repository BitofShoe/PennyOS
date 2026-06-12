use std::{
    env,
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command as StdCommand, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use tauri::{path::BaseDirectory, Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

enum PennyChild {
    Dev(Child),
    Sidecar(CommandChild),
}

#[derive(Clone, Default)]
struct PennyServer {
    child: Arc<Mutex<Option<PennyChild>>>,
    exit_message: Arc<Mutex<Option<String>>>,
}

impl PennyServer {
    fn set_child(&self, child: PennyChild) {
        if let Ok(mut guard) = self.child.lock() {
            *guard = Some(child);
        }
    }

    fn record_exit_message(&self, message: String) {
        if let Ok(mut guard) = self.exit_message.lock() {
            *guard = Some(message);
        }
    }

    fn take_exit_message(&self) -> Option<String> {
        self.exit_message
            .lock()
            .ok()
            .and_then(|mut guard| guard.take())
    }

    fn kill(&self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(child) = guard.take() {
                match child {
                    PennyChild::Dev(mut child) => {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                    PennyChild::Sidecar(child) => {
                        let _ = child.kill();
                    }
                }
            }
        }
    }

    fn exit_message_if_stopped(&self) -> Option<String> {
        if let Some(message) = self.take_exit_message() {
            return Some(message);
        }

        let Ok(mut guard) = self.child.lock() else {
            return None;
        };
        let Some(PennyChild::Dev(child)) = guard.as_mut() else {
            return None;
        };

        match child.try_wait() {
            Ok(Some(status)) => {
                *guard = None;
                Some(format!(
                    "The Penny server exited before Penny became ready ({status}). Check the path set in PENNY_TAURI_LOG."
                ))
            }
            Ok(None) => None,
            Err(error) => Some(format!(
                "Could not inspect the Penny server process: {error}"
            )),
        }
    }
}

#[derive(Clone)]
struct PackagedPaths {
    runtime_root: PathBuf,
    server_js: PathBuf,
    app_data_dir: PathBuf,
    config_dir: PathBuf,
    env_file: PathBuf,
    log_path: PathBuf,
}

fn env_u16(name: &str, fallback: u16) -> u16 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(fallback)
}

fn env_u64(name: &str, fallback: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(fallback)
}

fn env_enabled(name: &str) -> bool {
    env::var(name)
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

fn force_packaged_runtime() -> bool {
    env_enabled("PENNY_TAURI_FORCE_SIDECAR")
}

fn force_dev_runtime() -> bool {
    env_enabled("PENNY_TAURI_FORCE_DEV_NODE")
}

fn candidate_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(root) = env::var("PENNY_TAURI_SERVER_ROOT") {
        roots.push(PathBuf::from(root));
    }

    if let Ok(current) = env::current_dir() {
        roots.push(current.clone());
        if current
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name == "src-tauri")
        {
            if let Some(parent) = current.parent() {
                roots.push(parent.to_path_buf());
            }
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    roots.push(manifest_dir.clone());
    if let Some(parent) = manifest_dir.parent() {
        roots.push(parent.to_path_buf());
    }

    roots
}

fn dev_penny_root() -> Option<PathBuf> {
    candidate_roots()
        .into_iter()
        .find(|root| root.join("server.js").exists())
}

fn penny_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/")
}

fn tauri_log_path(root: &Path) -> PathBuf {
    env::var("PENNY_TAURI_LOG")
        .map(PathBuf::from)
        .unwrap_or_else(|_| root.join("logs").join("penny-tauri-server.log"))
}

fn status_probe(port: u16) -> bool {
    let Some(addr) = ("127.0.0.1", port)
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next())
    else {
        return false;
    };

    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(350)) else {
        return false;
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(650)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(650)));

    let request = b"GET /api/penny/status HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
    if stream.write_all(request).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    status_response_indicates_ready(&response)
}

fn status_response_indicates_ready(response: &str) -> bool {
    let Some(status_line) = response.lines().next() else {
        return false;
    };
    if !(status_line.contains(" 200 ")
        || status_line.ends_with(" 200")
        || status_line.contains("200 OK"))
    {
        return false;
    }

    let compact_response: String = response
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect();
    compact_response.contains("\"name\":\"Penny\"")
}

fn wait_for_penny_ready(
    port: u16,
    timeout: Duration,
    server_state: Option<&PennyServer>,
) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if status_probe(port) {
            return Ok(());
        }
        if let Some(state) = server_state {
            if let Some(message) = state.exit_message_if_stopped() {
                return Err(message);
            }
        }
        thread::sleep(Duration::from_millis(250));
    }
    Err(format!(
        "Penny did not become ready at {} before the startup timeout.",
        penny_url(port)
    ))
}

#[cfg(test)]
mod tests {
    use super::{escape_loading_status_message, status_response_indicates_ready};

    #[test]
    fn readiness_probe_accepts_pretty_status_json() {
        let response = "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{\n  \"ok\": true,\n  \"name\": \"Penny\"\n}\n";
        assert!(status_response_indicates_ready(response));
    }

    #[test]
    fn readiness_probe_rejects_non_penny_status() {
        let response = "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n{\"ok\":true,\"name\":\"Other\"}";
        assert!(!status_response_indicates_ready(response));
    }

    #[test]
    fn readiness_probe_rejects_failed_http_status() {
        let response = "HTTP/1.1 503 Service Unavailable\r\ncontent-type: application/json\r\n\r\n{\"ok\":false,\"name\":\"Penny\"}";
        assert!(!status_response_indicates_ready(response));
    }

    #[test]
    fn loading_status_escape_blocks_template_interpolation() {
        assert_eq!(
            escape_loading_status_message("boot ${window.evil}`\\\r\nnext ${again}"),
            "boot \\${window.evil}\\`\\\\\\r\\nnext \\${again}"
        );
    }
}

fn ensure_server_log(log_path: &Path) {
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "\n--- Penny Tauri server start ---");
    }
}

fn append_server_log(log_path: &Path, label: &str, message: &str) {
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) else {
        return;
    };
    for line in message.replace("\r\n", "\n").split('\n') {
        if line.trim().is_empty() {
            continue;
        }
        let _ = writeln!(file, "[{label}] {line}");
    }
}

fn append_server_log_bytes(log_path: &Path, label: &str, bytes: &[u8]) {
    append_server_log(log_path, label, &String::from_utf8_lossy(bytes));
}

fn attach_server_log(command: &mut StdCommand, root: &Path) {
    let log_path = tauri_log_path(root);
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) else {
        command.stdout(Stdio::null()).stderr(Stdio::null());
        return;
    };

    let _ = writeln!(file, "\n--- Penny Tauri server start ---");
    match file.try_clone() {
        Ok(stderr_file) => {
            command
                .stdout(Stdio::from(file))
                .stderr(Stdio::from(stderr_file));
        }
        Err(_) => {
            command.stdout(Stdio::from(file)).stderr(Stdio::null());
        }
    }
}

fn resolve_app_path(
    app: &tauri::AppHandle,
    relative: &str,
    base: BaseDirectory,
) -> Result<PathBuf, String> {
    app.path()
        .resolve(relative, base)
        .map_err(|error| format!("Could not resolve Tauri {base:?} path for {relative}: {error}"))
}

fn packaged_paths(app: &tauri::AppHandle) -> Result<PackagedPaths, String> {
    let runtime_root = resolve_app_path(app, "penny-runtime", BaseDirectory::Resource)?;
    let app_data_dir = resolve_app_path(app, "data", BaseDirectory::AppData)?;
    let config_dir = resolve_app_path(app, "", BaseDirectory::AppConfig)?;
    let log_path = env::var("PENNY_TAURI_LOG")
        .map(PathBuf::from)
        .unwrap_or(resolve_app_path(
            app,
            "penny-tauri-server.log",
            BaseDirectory::AppLog,
        )?);

    Ok(PackagedPaths {
        server_js: runtime_root.join("server.js"),
        runtime_root,
        env_file: config_dir.join(".env"),
        app_data_dir,
        config_dir,
        log_path,
    })
}

fn create_packaged_dirs(paths: &PackagedPaths) {
    let _ = fs::create_dir_all(&paths.app_data_dir);
    let _ = fs::create_dir_all(&paths.config_dir);
    if let Some(parent) = paths.log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn packaged_env_vars(paths: &PackagedPaths, port: u16) -> Vec<(&'static str, String)> {
    let data = &paths.app_data_dir;
    let config = &paths.config_dir;
    vec![
        ("PORT", port.to_string()),
        ("HOST", "127.0.0.1".to_string()),
        ("PENNY_HOST", "127.0.0.1".to_string()),
        ("PENNY_TAURI", "1".to_string()),
        ("PENNY_SKIP_LMSTUDIO_PREP", "1".to_string()),
        ("PENNY_TAURI_APP_DATA_DIR", path_text(data)),
        ("PENNY_DATA_DIR", path_text(data)),
        ("PENNY_CONFIG_DIR", path_text(config)),
        ("PENNY_ENV_FILE", path_text(&paths.env_file)),
        (
            "PENNY_MEMORY_FILE",
            path_text(&data.join("penny-memory.json")),
        ),
        (
            "PENNY_MEMORY_ARCHIVE_FILE",
            path_text(&data.join("penny-memory-archive.json")),
        ),
        (
            "PENNY_MEMORY_EMBEDDINGS_FILE",
            path_text(&data.join("penny-memory-embeddings.json")),
        ),
        (
            "PENNY_MEMORY_LEDGER_FILE",
            path_text(&data.join("penny-memory-ledger.json")),
        ),
        (
            "PENNY_MEMORY_BOOKS_FILE",
            path_text(&data.join("penny-memory-books.json")),
        ),
        (
            "PENNY_OPEN_LOOP_FILE",
            path_text(&data.join("penny-open-loops.json")),
        ),
        (
            "PENNY_PENDING_WORKSPACE_WRITES_FILE",
            path_text(&data.join("penny-pending-workspace-writes.json")),
        ),
        (
            "PENNY_STATIC_EMBED_CACHE_FILE",
            path_text(&data.join("penny-memory-embeddings.static.json")),
        ),
        (
            "PENNY_LOCAL_MODEL_PREFERENCE_FILE",
            path_text(&config.join(".penny-local-preferences.json")),
        ),
        ("PENNY_TAURI_LOG", path_text(&paths.log_path)),
    ]
}

fn start_dev_penny_server(port: u16, root: PathBuf) -> Result<Option<PennyChild>, String> {
    let server_js = root.join("server.js");
    if !server_js.exists() {
        return Err(format!(
            "Could not find Penny server.js. Set PENNY_TAURI_SERVER_ROOT to the Penny checkout."
        ));
    }

    let node = env::var("PENNY_TAURI_NODE").unwrap_or_else(|_| {
        if cfg!(windows) {
            "node.exe".to_string()
        } else {
            "node".to_string()
        }
    });

    let mut command = StdCommand::new(node);
    command
        .arg(server_js)
        .current_dir(&root)
        .env("PORT", port.to_string())
        .env("HOST", "127.0.0.1")
        .env("PENNY_HOST", "127.0.0.1")
        .env("PENNY_TAURI", "1")
        .stdin(Stdio::null());

    attach_server_log(&mut command, &root);

    if env::var_os("PENNY_SKIP_LMSTUDIO_PREP").is_none() {
        command.env("PENNY_SKIP_LMSTUDIO_PREP", "1");
    }

    command
        .spawn()
        .map(|child| Some(PennyChild::Dev(child)))
        .map_err(|error| format!("Failed to start Penny server: {error}"))
}

fn spawn_sidecar_log_task(
    mut rx: tauri::async_runtime::Receiver<CommandEvent>,
    log_path: PathBuf,
    server_state: PennyServer,
) {
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => append_server_log_bytes(&log_path, "stdout", &bytes),
                CommandEvent::Stderr(bytes) => append_server_log_bytes(&log_path, "stderr", &bytes),
                CommandEvent::Error(error) => append_server_log(&log_path, "error", &error),
                CommandEvent::Terminated(payload) => {
                    let message = format!(
                        "The Penny server exited before Penny became ready (code {:?}, signal {:?}). Check {}.",
                        payload.code,
                        payload.signal,
                        path_text(&log_path)
                    );
                    append_server_log(&log_path, "terminated", &message);
                    server_state.record_exit_message(message);
                    break;
                }
                _ => {}
            }
        }
    });
}

fn start_packaged_penny_server(
    app: &tauri::AppHandle,
    port: u16,
    server_state: &PennyServer,
) -> Result<Option<PennyChild>, String> {
    let paths = packaged_paths(app)?;
    if !paths.server_js.exists() {
        return Err(format!(
            "Could not find bundled Penny runtime at {}. Run npm run tauri:sidecar:build before building the Tauri app.",
            path_text(&paths.server_js)
        ));
    }

    create_packaged_dirs(&paths);
    ensure_server_log(&paths.log_path);

    let mut command = app
        .shell()
        .sidecar("penny-node")
        .map_err(|error| format!("Could not resolve bundled Penny sidecar: {error}"))?
        .arg("server.js")
        .current_dir(&paths.runtime_root);

    for (key, value) in packaged_env_vars(&paths, port) {
        command = command.env(key, value);
    }

    let (rx, child) = command
        .spawn()
        .map_err(|error| format!("Failed to start bundled Penny sidecar: {error}"))?;
    spawn_sidecar_log_task(rx, paths.log_path, server_state.clone());
    Ok(Some(PennyChild::Sidecar(child)))
}

fn start_penny_server(
    app: &tauri::AppHandle,
    port: u16,
    server_state: &PennyServer,
) -> Result<Option<PennyChild>, String> {
    if status_probe(port) {
        return Ok(None);
    }

    if force_dev_runtime()
        || env::var_os("PENNY_TAURI_SERVER_ROOT").is_some()
        || env::var_os("PENNY_TAURI_NODE").is_some()
    {
        let root = dev_penny_root().ok_or_else(|| {
            "Could not find Penny server.js. Set PENNY_TAURI_SERVER_ROOT to the Penny checkout."
                .to_string()
        })?;
        return start_dev_penny_server(port, root);
    }

    if cfg!(debug_assertions) && !force_packaged_runtime() {
        if let Some(root) = dev_penny_root() {
            return start_dev_penny_server(port, root);
        }
    }

    match start_packaged_penny_server(app, port, server_state) {
        Ok(child) => Ok(child),
        Err(packaged_error) => {
            if cfg!(debug_assertions) && !force_packaged_runtime() {
                if let Some(root) = dev_penny_root() {
                    return start_dev_penny_server(port, root);
                }
            }
            if env_enabled("PENNY_TAURI_ALLOW_DEV_FALLBACK") {
                let Some(root) = dev_penny_root() else {
                    return Err(packaged_error);
                };
                return start_dev_penny_server(port, root);
            }
            Err(packaged_error)
        }
    }
}

fn escape_loading_status_message(message: &str) -> String {
    message
        .replace('\\', "\\\\")
        .replace("${", "\\${")
        .replace('`', "\\`")
        .replace('\r', "\\r")
        .replace('\n', "\\n")
}

fn set_loading_status(window: &tauri::WebviewWindow, message: &str) {
    let escaped = escape_loading_status_message(message);
    let _ = window.eval(&format!("window.__pennyTauriSetStatus(`{escaped}`)"));
}

fn main() {
    let server_state = PennyServer::default();
    let cleanup_state = server_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let port = env_u16("PENNY_TAURI_PORT", 4317);
            let timeout = Duration::from_millis(env_u64("PENNY_TAURI_READY_TIMEOUT_MS", 30_000));
            let Some(window) = app.get_webview_window("main") else {
                return Ok(());
            };
            let app_handle = app.handle().clone();

            if let Err(message) =
                start_penny_server(&app_handle, port, &server_state).map(|child| {
                    if let Some(child) = child {
                        server_state.set_child(child);
                    }
                })
            {
                set_loading_status(&window, &message);
                return Ok(());
            }

            let url = penny_url(port);
            match wait_for_penny_ready(port, timeout, Some(&server_state)) {
                Ok(()) => {
                    if let Ok(parsed) = tauri::Url::parse(&url) {
                        let _ = window.navigate(parsed);
                    }
                }
                Err(message) => {
                    set_loading_status(&window, &message);
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building PennyOS Tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                cleanup_state.kill();
            }
        });
}
