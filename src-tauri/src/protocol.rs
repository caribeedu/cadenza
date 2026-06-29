use serde::{Deserialize, Serialize};

pub const MSG_SCORE: &str = "score";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ScorePayload {
    #[serde(default)]
    pub r#type: Option<String>,
    pub bpm: Option<f64>,
    #[serde(default)]
    pub tempo_map: Vec<TempoMarker>,
    #[serde(default)]
    pub notes: Vec<ScoreNoteInput>,
    pub meta: Option<ScoreMeta>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TempoMarker {
    pub offset_ql: f64,
    pub bpm: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ScoreNoteInput {
    pub pitch: i32,
    pub offset_ql: f64,
    #[serde(default)]
    pub duration_ql: f64,
    #[serde(default)]
    pub track: i32,
    #[serde(default)]
    pub staff: i32,
    pub finger: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ScoreMeta {
    pub title: Option<String>,
    pub composer: Option<String>,
    pub parts: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScoreAck {
    pub ok: bool,
    pub notes: usize,
    pub bpm: f64,
    pub duration_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TimelineNote {
    pub id: i32,
    pub pitch: i32,
    pub start_ms: f64,
    pub duration_ms: f64,
    pub track: i32,
    pub staff: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finger: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Timeline {
    pub bpm: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub composer: Option<String>,
    pub duration_ms: f64,
    pub notes: Vec<TimelineNote>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatus {
    pub has_score: bool,
    pub note_count: usize,
    pub duration_ms: f64,
    pub midi_selected: Option<String>,
    pub playing: bool,
    pub paused: bool,
    pub position_ms: f64,
    pub speed: f64,
    pub tolerance_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorBody {
    pub error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorEvent {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResultEvent {
    pub correct: bool,
    pub played_pitch: i32,
    pub played_time_ms: f64,
    pub expected_id: Option<i32>,
    pub expected_pitch: Option<i32>,
    pub expected_time_ms: Option<f64>,
    pub delta_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub playing: bool,
    pub paused: bool,
    pub position_ms: f64,
    pub speed: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiNoteEvent {
    pub pitch: i32,
    pub velocity: i32,
    pub played_time_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiNoteOffEvent {
    pub pitch: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiPortsChanged {
    pub ports: Vec<String>,
    pub selected: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FingeringProgressEvent {
    pub done: usize,
    pub total: usize,
    pub hand: String,
}

#[cfg(test)]
mod tests {
    use super::ScorePayload;
    use crate::error::CadenzaError;
    use crate::timeline::build_timeline;
    use std::fs;

    fn load_fixture(name: &str) -> String {
        let path = format!("{}/../fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
        fs::read_to_string(&path).unwrap_or_else(|_| panic!("read {path}"))
    }

    #[test]
    fn invalid_bpm_fixture_fails_timeline() {
        let raw = load_fixture("invalid_bpm.json");
        let payload: ScorePayload = serde_json::from_str(&raw).expect("json");
        assert!(matches!(
            build_timeline(payload),
            Err(CadenzaError::InvalidBpm)
        ));
    }

    #[test]
    fn invalid_missing_pitch_fails_deserialize() {
        let raw = load_fixture("invalid_missing_pitch.json");
        let err = serde_json::from_str::<ScorePayload>(&raw).expect_err("missing pitch");
        assert!(err.to_string().contains("pitch"));
    }
}
