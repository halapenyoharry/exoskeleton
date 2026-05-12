mod osc;

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
        .invoke_handler(tauri::generate_handler![crate::osc::send_osc])
        .setup(|app| {
            crate::osc::setup(app.handle())?;
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                // Auto-open WebKit Inspector in debug builds so devtools is
                // one click away (otherwise you have to hunt for the keyboard
                // shortcut, which varies by platform / WebKit version).
                #[cfg(debug_assertions)]
                window.open_devtools();
                // Activate the app and bring the window forward, so an
                // auto-launch (VS Code's runOn:folderOpen task) doesn't leave
                // it sitting behind the IDE.
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
