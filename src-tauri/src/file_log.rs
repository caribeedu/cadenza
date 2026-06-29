use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

static LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn init(path: PathBuf) {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    *LOG_PATH.lock().unwrap() = Some(path);
    write_event("app_started", "");
}

pub fn log_path() -> Option<PathBuf> {
    LOG_PATH.lock().unwrap().clone()
}

pub fn write_event(event: &str, detail: &str) {
    let guard = LOG_PATH.lock().unwrap();
    let Some(path) = guard.as_ref() else {
        return;
    };
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let line = if detail.is_empty() {
        format!("{ts} {event}\n")
    } else {
        format!("{ts} {event} {detail}\n")
    };
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_lines_to_file() {
        let path = std::env::temp_dir().join(format!("cadenza-log-{}.log", std::process::id()));
        let _ = std::fs::remove_file(&path);
        init(path.clone());
        write_event("score_received", "notes=5");
        let body = std::fs::read_to_string(&path).expect("log file");
        assert!(body.contains("app_started"));
        assert!(body.contains("score_received notes=5"));
    }
}
