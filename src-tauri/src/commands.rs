use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use crate::PendingFile;
use tauri::Manager;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<DirEntry>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified: Option<u64>,
}

#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err(format!("Directory not found: {}", path));
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        if let Ok(entry) = entry {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_path = entry.path().to_string_lossy().to_string();
            let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);

            let children = if is_dir {
                match read_directory(file_path.clone()) {
                    Ok(ch) => Some(ch),
                    Err(_) => None,
                }
            } else {
                None
            };

            entries.push(DirEntry {
                name: file_name,
                path: file_path,
                is_dir,
                children,
            });
        }
    }

    entries.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FileInfo {
        name,
        path,
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        modified: metadata.modified().ok().map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        }),
    })
}

#[tauri::command]
pub fn get_pending_file(pending: tauri::State<PendingFile>) -> Option<String> {
    let file = pending.0.lock().unwrap().clone();
    file
}

#[tauri::command]
pub fn clear_pending_file(pending: tauri::State<PendingFile>) {
    *pending.0.lock().unwrap() = None;
}

#[tauri::command]
pub async fn open_in_new_window(
    app: tauri::AppHandle,
    file_path: String,
    hide_sidebar: Option<bool>,
) -> Result<(), String> {
    let label = format!("doc-{}", &uuid::Uuid::new_v4().to_string()[..8]);

    let url = tauri::WebviewUrl::App("/".into());

    let mut builder = tauri::WebviewWindowBuilder::new(&app, &label, url)
        .title("TMD")
        .inner_size(1200.0, 800.0)
        .decorations(false)
        .shadow(true);

    if hide_sidebar.unwrap_or(false) {
        builder = builder.initialization_script(r#"
            const initData = JSON.parse(window.__INIT_DATA__ || '{}');
            if (initData.hideSidebar) {
                document.body.classList.add('sidebar-hidden');
            }
        "#);
    }

    let window = builder.build().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    let init_data = serde_json::json!({
        "filePath": file_path,
        "hideSidebar": hide_sidebar.unwrap_or(false),
    });

    app.emit_to(&label, "new-window-init", init_data).map_err(|e| e.to_string())?;

    Ok(())
}
