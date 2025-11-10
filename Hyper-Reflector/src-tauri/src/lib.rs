// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use tauri::{AppHandle, Emitter, EventTarget, State, Manager};
use std::{
    env,
    fs::{self, OpenOptions},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tauri_plugin_shell::ShellExt;
use walkdir::WalkDir;

mod proxy;
use proxy::{kill_emulator_only, start_proxy, stop_proxy, ProxyManager};

// This saves the child process
#[derive(Default)]
struct ProcState {
    child: Option<tauri_plugin_shell::process::CommandChild>,
}

#[derive(Default)]
struct AudioState {
    sink: Mutex<Option<Arc<rodio::Sink>>>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// small helpers so we never fight the borrow checker again
fn take_sink(app: &tauri::AppHandle) -> Option<Arc<rodio::Sink>> {
    let audio = app.state::<AudioState>();
    let mut guard = audio.sink.lock().unwrap();
    guard.take() // guard drops here
}

fn set_sink(app: &tauri::AppHandle, new_sink: Option<Arc<rodio::Sink>>) {
    let audio = app.state::<AudioState>();
    let mut guard = audio.sink.lock().unwrap();
    *guard = new_sink; // guard drops here
}

fn resolve_path_common(app: &AppHandle, raw: &str, empty_msg: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(empty_msg.to_string());
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    let provided = PathBuf::from(trimmed);

    if provided.is_absolute() {
        candidates.push(provided.clone());
    } else {
        candidates.push(provided.clone());

        if let Ok(mut cwd) = env::current_dir() {
            for _ in 0..5 {
                candidates.push(cwd.join(&provided));
                if !cwd.pop() {
                    break;
                }
            }
        }

        if let Ok(exe_path) = env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                candidates.push(parent.join(&provided));
            }
            if let Some(grand) = exe_path.parent().and_then(|p| p.parent()) {
                candidates.push(grand.join(&provided));
            }
            let mut ancestor = exe_path.parent().map(|p| p.to_path_buf());
            for _ in 0..5 {
                if let Some(parent) = ancestor.as_mut() {
                    if parent.pop() && !parent.as_os_str().is_empty() {
                        candidates.push(parent.join(&provided));
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }

        if let Ok(resource_dir) = app.path().resource_dir() {
            candidates.push(resource_dir.join(&provided));
            if let Some(parent) = resource_dir.parent() {
                candidates.push(parent.join(&provided));
            }
        }

        if let Ok(app_dir) = app.path().app_data_dir() {
            candidates.push(app_dir.join(&provided));
        }

        if trimmed.starts_with("_up_/") {
            let remainder = trimmed.trim_start_matches("_up_/");
            if let Ok(resource_dir) = app.path().resource_dir() {
                if let Some(parent) = resource_dir.parent() {
                    candidates.push(parent.join(remainder));
                }
            }
        }
    }

    if let Some(existing) = candidates.iter().find(|path| path.exists()) {
        return Ok(existing.clone());
    }

    if let Some(first) = candidates.first() {
        if first.is_absolute() {
            return Ok(first.clone());
        }
        if let Ok(cwd) = env::current_dir() {
            return Ok(cwd.join(first));
        }
    }

    Ok(provided)
}

pub(crate) fn resolve_emulator_path(app: &AppHandle, raw: &str) -> Result<PathBuf, String> {
    resolve_path_common(app, raw, "Emulator path is empty")
}

fn resolve_generic_path(app: &AppHandle, raw: &str) -> Result<PathBuf, String> {
    resolve_path_common(app, raw, "Path is empty")
}

pub(crate) fn resolve_lua_args(app: &AppHandle, args: &mut Vec<String>) -> Result<(), String> {
    let mut idx = 0;
    while idx < args.len() {
        if args[idx].eq_ignore_ascii_case("--lua") {
            if idx + 1 < args.len() {
                let resolved = resolve_generic_path(app, &args[idx + 1])?;
                let cli_safe = resolved.to_string_lossy().replace('\\', "/");
                args[idx + 1] = cli_safe;
            }
            idx += 2;
        } else {
            idx += 1;
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in WalkDir::new(src) {
        let entry = entry?;
        let relative = entry.path().strip_prefix(src).unwrap();
        let target_path = dst.join(relative);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), &target_path)?;
        }
    }

    Ok(())
}

fn find_resource_folder(app: &AppHandle, name: &str) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join(name));
        if let Some(parent) = resource_dir.parent() {
            candidates.push(parent.join(name));
            candidates.push(parent.join("_up_").join(name));
        }
    }

    if let Ok(exe_dir) = app.path().executable_dir() {
        candidates.push(exe_dir.join(name));
        candidates.push(exe_dir.join("_up_").join(name));
        if let Some(parent) = exe_dir.parent() {
            candidates.push(parent.join(name));
            candidates.push(parent.join("_up_").join(name));
        }
    }

    if let Ok(mut cwd) = env::current_dir() {
        candidates.push(cwd.join(name));
        for _ in 0..5 {
            if cwd.pop() {
                candidates.push(cwd.join(name));
                candidates.push(cwd.join("_up_").join(name));
            } else {
                break;
            }
        }
    }

    candidates.push(PathBuf::from(format!("_up_/{}", name)));
    candidates.push(PathBuf::from(format!("../{}", name)));
    candidates.push(PathBuf::from(format!("../_up_/{}", name)));

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn ensure_resource_copy(app: &AppHandle, appdata_root: &Path, name: &str) -> Result<PathBuf, String> {
    let source = find_resource_folder(app, name)
        .ok_or_else(|| format!("Bundled resource folder '{}' not found", name))?;

    let target = appdata_root.join(name);
    if target.exists() {
        return Ok(target);
    }

    copy_dir_recursive(&source, &target).map_err(|e| e.to_string())?;
    Ok(target)
}

fn require_subdir(base: &Path, name: &str) -> Result<PathBuf, String> {
    let dir = base.join(name);
    if dir.exists() {
        Ok(dir)
    } else {
        Err(format!(
            "Required resource subfolder '{}' missing under '{}'",
            name,
            base.display()
        ))
    }
}

fn test_writable(dir: &Path) -> bool {
    if !dir.exists() {
        return false;
    }
    let probe = dir.join(".hyper-reflector-write-test");
    match OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&probe)
    {
        Ok(_) => {
            let _ = fs::remove_file(probe);
            true
        }
        Err(_) => false,
    }
}

fn ensure_writable_files_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(exe_dir) = app.path().executable_dir() {
        let exe_files = exe_dir.join("files");
        if exe_files.exists() && test_writable(&exe_files) {
            return Ok(exe_files);
        }

        if !exe_files.exists() && test_writable(&exe_dir) {
            if let Some(source) = find_resource_folder(app, "files") {
                if copy_dir_recursive(&source, &exe_files).is_ok() && test_writable(&exe_files) {
                    return Ok(exe_files);
                } else if exe_files.exists() {
                    let _ = fs::remove_dir_all(&exe_files);
                }
            }
        }
    }

    let appdata_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&appdata_dir).map_err(|e| e.to_string())?;
    let files_dir = ensure_resource_copy(app, &appdata_dir, "files")?;
    if test_writable(&files_dir) {
        return Ok(files_dir);
    }

    Err("Unable to prepare a writable 'files' directory".to_string())
}

#[derive(Serialize)]
struct PreparedResources {
    emulator_path: String,
    emulator_dir: String,
    lua_dir: String,
    sounds_dir: String,
    files_dir: String,
}

#[tauri::command]
async fn prepare_user_resources(app: tauri::AppHandle) -> Result<PreparedResources, String> {
    let files_dir = ensure_writable_files_dir(&app)?;

    let emulator_dir = require_subdir(&files_dir, "emu")?;
    let lua_dir = require_subdir(&files_dir, "lua")?;
    let sounds_dir = require_subdir(&files_dir, "sounds")?;

    let emulator_path = emulator_dir
        .join("hyper-screw-fbneo")
        .join("fs-fbneo.exe");

    Ok(PreparedResources {
        emulator_path: emulator_path.to_string_lossy().to_string(),
        emulator_dir: emulator_dir.to_string_lossy().to_string(),
        lua_dir: lua_dir.to_string_lossy().to_string(),
        sounds_dir: sounds_dir.to_string_lossy().to_string(),
        files_dir: files_dir.to_string_lossy().to_string(),
    })
}


#[tauri::command]
fn stop_sound(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(sink) = take_sink(&app) {
        sink.stop();
    }
    Ok(())
}


#[tauri::command]
fn play_sound(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let resolved = resolve_generic_path(&app, &path)?;
    // Quick check so we error fast
    std::fs::File::open(&resolved).map_err(|e| format!("open failed: {e}"))?;

    // Stop anything already playing
    if let Some(old) = take_sink(&app) {
        old.stop();
    }

    // Worker thread to keep OutputStream alive while playing
    std::thread::spawn(move || {
        let stream = match rodio::OutputStreamBuilder::open_default_stream() {
            Ok(s) => s,
            Err(e) => { eprintln!("audio: open stream failed: {e}"); return; }
        };

        let sink = Arc::new(rodio::Sink::connect_new(&stream.mixer()));

        // publish handle (drop guard inside helper)
        set_sink(&app, Some(sink.clone()));

        // open & decode
        let file = match std::fs::File::open(&resolved) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("audio: open file failed: {e}");
                set_sink(&app, None);
                return;
            }
        };
        let source = match rodio::Decoder::try_from(file) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("audio: decode failed: {e}");
                set_sink(&app, None);
                return;
            }
        };

        sink.append(source);
        sink.sleep_until_end();

        // clear the handle if it's still this sink
        let current = take_sink(&app);
        if let Some(cur) = current {
            if !Arc::ptr_eq(&cur, &sink) {
                // someone else started a new sound; put it back
                set_sink(&app, Some(cur));
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn start_training_mode(
    app: tauri::AppHandle,
    proc: State<'_, Arc<Mutex<ProcState>>>,
    use_sidecar: bool,
    exe_path: Option<String>,
    mut args: Vec<String>,
) -> Result<(), String> {
    let cmd_builder = if use_sidecar {
        app.shell().sidecar("emulator").map_err(|e| e.to_string())?
    } else {
        // need to set up sidecar code later
        let path = exe_path.ok_or("exe_path required when use_sidecar=false")?;
        let resolved = resolve_emulator_path(&app, &path)?;
        app.shell().command(resolved)
    };
    resolve_lua_args(&app, &mut args)?;
    let cmd = cmd_builder.args(args);
    let (mut rx, child) = cmd.spawn().map_err(|e| e.to_string())?;
    {
        let mut guard = proc.lock().unwrap();
        guard.child = Some(child);
    }

    tauri::async_runtime::spawn({
        let app = app.clone();
        async move {
            use tauri_plugin_shell::process::CommandEvent;
            // while let Some(event) = rx.recv().await {
            //     match event {
            //         CommandEvent::Stdout(bytes) => {
            //             let line = String::from_utf8_lossy(&bytes).to_string();
            //             let _ = app.emit("emulator:stdout", line);
            //         }
            //         CommandEvent::Stderr(bytes) => {
            //             let line = String::from_utf8_lossy(&bytes).to_string();
            //             let _ = app.emit("emulator:stderr", line);
            //         }
            //         CommandEvent::Terminated(payload) => {
            //             let _ = app.emit("emulator:exit", payload);
            //         }
            //         _ => {}
            //     }
            // }
        }
    });

    Ok(())
}

#[tauri::command]
async fn launch_emulator(app: tauri::AppHandle, exe_path: String, mut args: Vec<String>) -> Result<(), String> {
    let resolved = resolve_emulator_path(&app, &exe_path)?;
    resolve_lua_args(&app, &mut args)?;
    let command = app
        .shell()
        .command(resolved)
        .args(args);
    let (_rx, _child) = command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

//Just for testing
#[tauri::command]
async fn run_custom_process() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let args = ["-n", "1", "example.com"];
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let args = ["-c", "1", "example.com"];

    let output = std::process::Command::new("ping")
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    println!("Hello, world!");
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_prevent_default::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(ProcState::default())))
        .manage(AudioState::default())
        .manage(ProxyManager::new())
        .invoke_handler(tauri::generate_handler![
            play_sound,
            stop_sound,
            greet,
            start_training_mode,
            launch_emulator,
            run_custom_process,
            start_proxy,
            stop_proxy,
            kill_emulator_only,
            prepare_user_resources,
            read_files_text,
            write_files_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn resolve_files_path(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    let base = ensure_writable_files_dir(app)?;
    let candidate = PathBuf::from(relative);
    let full = if candidate.is_absolute() {
        candidate
    } else {
        base.join(candidate)
    };
    Ok(full)
}

#[tauri::command]
fn read_files_text(app: tauri::AppHandle, relative_path: String) -> Result<String, String> {
    let path = resolve_files_path(&app, &relative_path)?;
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_files_text(
    app: tauri::AppHandle,
    relative_path: String,
    contents: String,
) -> Result<(), String> {
    let path = resolve_files_path(&app, &relative_path)?;
    std::fs::write(path, contents).map_err(|e| e.to_string())
}
