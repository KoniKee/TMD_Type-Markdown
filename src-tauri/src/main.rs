#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;

use std::sync::Mutex;
use tauri::Manager;
use tauri::Emitter;

struct PendingFile(Mutex<Option<String>>);

fn handle_file_open(app: &tauri::AppHandle, path: String) {
    let _ = app.emit("file-open", path);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let initial_file = if args.len() > 1 && !args[1].starts_with('-') {
        Some(args[1].clone())
    } else {
        None
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.len() > 1 && !args[1].starts_with('-') {
                handle_file_open(app, args[1].clone());
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .manage(PendingFile(Mutex::new(initial_file)))
        .invoke_handler(tauri::generate_handler![
            commands::read_directory,
            commands::get_file_info,
            commands::get_pending_file,
            commands::clear_pending_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
