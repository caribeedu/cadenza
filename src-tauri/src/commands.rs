use crate::app_state::SharedAppState;
use crate::protocol::{AppStatus, Timeline, ValidationResultEvent};

#[tauri::command]
pub fn ping() -> String {
    "pong".into()
}

#[tauri::command]
pub fn get_status(state: tauri::State<'_, SharedAppState>) -> AppStatus {
    state.status()
}

#[tauri::command]
pub fn get_timeline(state: tauri::State<'_, SharedAppState>) -> Option<Timeline> {
    state.timeline()
}

#[tauri::command]
pub fn play(state: tauri::State<'_, SharedAppState>) -> Result<(), String> {
    state.play()
}

#[tauri::command]
pub fn pause(state: tauri::State<'_, SharedAppState>) -> Result<(), String> {
    state.pause()
}

#[tauri::command]
pub fn resume(state: tauri::State<'_, SharedAppState>) -> Result<(), String> {
    state.resume()
}

#[tauri::command]
pub fn stop(state: tauri::State<'_, SharedAppState>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
pub fn seek(state: tauri::State<'_, SharedAppState>, position_ms: f64) -> Result<(), String> {
    state.seek(position_ms)
}

#[tauri::command]
pub fn set_speed(state: tauri::State<'_, SharedAppState>, speed: f64) -> Result<(), String> {
    state.set_speed(speed)
}

#[tauri::command]
pub fn set_tolerance(
    state: tauri::State<'_, SharedAppState>,
    tolerance_ms: f64,
) -> Result<(), String> {
    state.set_tolerance(tolerance_ms)
}

#[tauri::command]
pub fn select_midi(state: tauri::State<'_, SharedAppState>, port: String) -> Result<(), String> {
    state.select_midi(port)
}

#[tauri::command]
pub fn list_midi_ports(state: tauri::State<'_, SharedAppState>) -> Vec<String> {
    state.refresh_midi_ports();
    crate::midi::list_input_ports()
}

#[tauri::command]
pub fn validate_note(
    state: tauri::State<'_, SharedAppState>,
    pitch: i32,
    played_time_ms: Option<f64>,
) -> Result<ValidationResultEvent, String> {
    state.validate_note_at(pitch, played_time_ms)
}

#[tauri::command]
pub fn muse_score_plugin_dir() -> Result<String, String> {
    crate::plugin_install::muse_score_plugins_dir()
        .map(|p| p.display().to_string())
}

#[tauri::command]
pub fn install_musescore_plugin(app: tauri::AppHandle) -> Result<crate::plugin_install::PluginInstallResult, String> {
    crate::plugin_install::install_musescore_plugin(&app)
}
