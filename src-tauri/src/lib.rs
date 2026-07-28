mod osc;

#[tauri::command]
fn open_workspace_window(app: tauri::AppHandle, workspace_id: String) -> Result<(), String> {
    use tauri::webview::NewWindowResponse;
    let label = format!("ws-{}", workspace_id);
    let url = format!("index.html?workspace={}", workspace_id);
    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
        .title("Exoskeleton")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .disable_drag_drop_handler()
        .on_new_window(|_url, _features| NewWindowResponse::Allow)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            // Unified logging from both Rust and JS. Writes to:
            //   - stdout (visible in the `npm run tauri dev` terminal)
            //   - the OS log dir (macOS: ~/Library/Logs/dev.harold.exoskeleton/)
            //   - the WebView console (visible in the auto-opened devtools)
            // JS side imports from `@tauri-apps/plugin-log` to emit logs.
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                // INFO globally; tao's window-event tracing is too noisy at TRACE.
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            crate::osc::send_osc,
            open_workspace_window
        ])
        .setup(|app| {
            crate::osc::setup(app.handle())?;
            use tauri::menu::{Menu, MenuItemBuilder, Submenu};
            use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
            use tauri::Emitter;

            let window = WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("Exoskeleton")
                .inner_size(1200.0, 800.0)
                .min_inner_size(800.0, 500.0)
                .disable_drag_drop_handler()
                // Dockview pops out groups via window.open(). Without this handler
                // WKWebView returns nil and the popout silently no-ops.
                .on_new_window(|_url, _features| NewWindowResponse::Allow)
                .build()?;

            #[cfg(debug_assertions)]
            window.open_devtools();

            let _ = window.set_focus();

            // Menu accelerators fire at the OS level, before keys reach any
            // subview — including iframes (LanWebview) and xterm. A
            // window-level keydown listener can't see keys typed inside a
            // cross-origin iframe; this is the only way to get a global
            // shortcut that works regardless of focus.
            let menu = Menu::default(app.handle())?;
            let toggle_settings = MenuItemBuilder::with_id("toggle-settings", "Toggle Settings")
                .accelerator("CmdOrCtrl+B")
                .build(app)?;
            let view_menu = Submenu::with_items(
                app.handle(),
                "View",
                true,
                &[&toggle_settings],
            )?;
            menu.append(&view_menu)?;
            app.set_menu(menu)?;

            app.handle().on_menu_event(|handle, event| {
                if event.id() == "toggle-settings" {
                    let _ = handle.emit("shortcut:toggle-settings", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
