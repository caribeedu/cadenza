#![allow(dead_code)]

mod app_state;
mod commands;
mod error;
mod file_log;
mod fingering_assign;
mod http_ingest;
mod midi;
mod performer_fingering;
mod playback;
mod plugin_install;
mod protocol;
mod timeline;
mod validator;

use std::sync::Arc;

use app_state::{spawn_playback_loop, AppState};
use commands::{
    get_status, get_timeline, check_musescore_plugin, install_musescore_plugin, list_midi_ports, muse_score_plugin_dir,
    pause, ping, play, resume, seek, select_midi, set_speed, set_tolerance, stop, validate_note,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            if let Ok(dir) = handle.path().app_log_dir() {
                file_log::init(dir.join("cadenza.log"));
            }
            let state = Arc::new(AppState::new(handle));
            spawn_playback_loop(state.clone());
            http_ingest::spawn_http_server(state.clone());
            state.refresh_midi_ports();
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            get_status,
            get_timeline,
            play,
            pause,
            resume,
            stop,
            seek,
            set_speed,
            set_tolerance,
            select_midi,
            list_midi_ports,
            validate_note,
            check_musescore_plugin,
            install_musescore_plugin,
            muse_score_plugin_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
