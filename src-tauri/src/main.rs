mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_directory,
            commands::get_file_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
