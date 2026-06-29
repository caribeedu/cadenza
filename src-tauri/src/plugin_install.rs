use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallResult {
    pub dest: String,
    pub already_installed: bool,
}

pub fn muse_score_plugins_dir() -> Result<PathBuf, String> {
    let home = home_dir().ok_or_else(|| "could not resolve home directory".to_string())?;
    #[cfg(target_os = "linux")]
    {
        Ok(home.join(".local/share/MuseScore/MuseScore4/Plugins"))
    }
    #[cfg(target_os = "macos")]
    {
        return Ok(home.join("Documents/MuseScore4/Plugins"));
    }
    #[cfg(target_os = "windows")]
    {
        return Ok(home.join("Documents/MuseScore4/Plugins"));
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Err("unsupported platform for MuseScore plugin install".into())
    }
}

pub fn bundled_plugin_source(app: &AppHandle) -> Result<PathBuf, String> {
    let resource = app
        .path()
        .resolve("plugin/Cadenza.qml", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    if resource.is_file() {
        return Ok(resource);
    }

    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../plugin/Cadenza.qml");
    if dev.is_file() {
        return Ok(dev);
    }

    Err("Cadenza.qml not found in app resources".into())
}

pub fn install_musescore_plugin(app: &AppHandle) -> Result<PluginInstallResult, String> {
    let source = bundled_plugin_source(app)?;
    let dest_dir = muse_score_plugins_dir()?;
    fs::create_dir_all(&dest_dir).map_err(|e| format!("create plugin dir: {e}"))?;
    let dest = dest_dir.join("Cadenza.qml");
    let already_installed = dest.is_file()
        && fs::read(&dest)
            .ok()
            .zip(fs::read(&source).ok())
            .map(|(a, b)| a == b)
            .unwrap_or(false);

    fs::copy(&source, &dest).map_err(|e| format!("copy plugin: {e}"))?;

    Ok(PluginInstallResult {
        dest: dest.display().to_string(),
        already_installed,
    })
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE").map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dev_plugin_fixture_exists() {
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../plugin/Cadenza.qml");
        assert!(dev.is_file(), "plugin fixture missing at {}", dev.display());
    }

    #[test]
    fn plugins_dir_under_home() {
        if home_dir().is_none() {
            return;
        }
        let dir = muse_score_plugins_dir().expect("plugins dir");
        assert!(dir.ends_with("Plugins"));
    }
}
