use crate::error::CadenzaError;
use crate::protocol::{
    ScoreMeta, ScoreNoteInput, ScorePayload, Timeline, TimelineNote, MSG_SCORE,
};

const DEFAULT_BPM: f64 = 120.0;

pub fn build_timeline(payload: ScorePayload) -> Result<Timeline, CadenzaError> {
    build_timeline_with_progress(payload, |_| {})
}

pub fn build_timeline_with_progress(
    payload: ScorePayload,
    progress: impl FnMut(crate::protocol::FingeringProgressEvent),
) -> Result<Timeline, CadenzaError> {
    let bpm = payload.bpm.unwrap_or(DEFAULT_BPM);
    if bpm <= 0.0 {
        return Err(CadenzaError::InvalidBpm);
    }

    let payload_type = payload.r#type.as_deref().unwrap_or(MSG_SCORE);
    if payload_type != MSG_SCORE {
        return Err(CadenzaError::UnsupportedType(payload_type.to_string()));
    }

    let segments = build_tempo_segments(&payload.tempo_map, bpm);
    let title = extract_title(payload.meta.as_ref());
    let composer = extract_composer(payload.meta.as_ref());

    let mut resolved = Vec::new();
    let mut next_id = 0i32;

    for raw in payload.notes {
        if let Some(note) = resolve_note(&raw, &segments, bpm, next_id) {
            next_id += 1;
            resolved.push(note);
        }
    }

    resolved.sort_by(|a, b| {
        a.start_ms
            .partial_cmp(&b.start_ms)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.pitch.cmp(&b.pitch))
    });

    resolved = crate::fingering_assign::assign_fingerings_with_progress(resolved, progress);

    let duration_ms = resolved
        .iter()
        .map(|n| n.start_ms + n.duration_ms)
        .fold(0.0_f64, f64::max);

    Ok(Timeline {
        bpm,
        title,
        composer,
        duration_ms,
        notes: resolved,
    })
}

fn resolve_note(
    raw: &ScoreNoteInput,
    segments: &[(f64, f64)],
    default_bpm: f64,
    id: i32,
) -> Option<TimelineNote> {
    if raw.pitch < 0 || raw.pitch > 127 || raw.offset_ql < 0.0 || raw.duration_ql < 0.0 {
        return None;
    }

    let duration_ql = raw.duration_ql.max(1e-6);
    let start_ms = ql_to_ms(raw.offset_ql, segments, default_bpm);
    let end_ms = ql_to_ms(raw.offset_ql + duration_ql, segments, default_bpm);
    let duration_ms = (end_ms - start_ms).max(0.0);

    let staff = raw.staff.max(0);
    let finger = raw.finger.filter(|f| (1..=5).contains(f));

    Some(TimelineNote {
        id,
        pitch: raw.pitch,
        start_ms,
        duration_ms,
        track: raw.track,
        staff,
        finger,
    })
}

fn build_tempo_segments(markers: &[crate::protocol::TempoMarker], default_bpm: f64) -> Vec<(f64, f64)> {
    let mut at_offset: std::collections::BTreeMap<i64, f64> = std::collections::BTreeMap::new();

    for marker in markers {
        if marker.bpm <= 0.0 || marker.offset_ql < 0.0 {
            continue;
        }
        let key = (marker.offset_ql * 1_000_000_000.0).round() as i64;
        at_offset.insert(key, marker.bpm);
    }

    let mut segments: Vec<(f64, f64)> = at_offset
        .into_iter()
        .map(|(k, bpm)| (k as f64 / 1_000_000_000.0, bpm))
        .collect();

    if segments.is_empty() {
        segments.push((0.0, default_bpm));
    } else if segments[0].0 > 0.0 {
        segments.insert(0, (0.0, default_bpm));
    }

    segments
}

/// Convert quarter-length offset from score start to absolute milliseconds.
fn ql_to_ms(offset_ql: f64, segments: &[(f64, f64)], default_bpm: f64) -> f64 {
    if segments.is_empty() {
        return offset_ql * 60000.0 / default_bpm;
    }

    let mut ms = 0.0;
    let mut pos = 0.0;

    for (index, &(start, bpm)) in segments.iter().enumerate() {
        let end = segments
            .get(index + 1)
            .map(|segment| segment.0)
            .unwrap_or(f64::INFINITY);

        if offset_ql <= start {
            break;
        }

        let seg_begin = start.max(pos);
        if offset_ql <= end {
            ms += (offset_ql - seg_begin) * 60000.0 / bpm;
            return ms;
        }

        if end > seg_begin {
            ms += (end - seg_begin) * 60000.0 / bpm;
        }
        pos = end;
    }

    ms
}

fn extract_title(meta: Option<&ScoreMeta>) -> Option<String> {
    extract_meta_field(meta, |m| m.title.as_ref())
}

fn extract_composer(meta: Option<&ScoreMeta>) -> Option<String> {
    extract_meta_field(meta, |m| m.composer.as_ref())
}

fn extract_meta_field(
    meta: Option<&ScoreMeta>,
    pick: impl Fn(&ScoreMeta) -> Option<&String>,
) -> Option<String> {
    let value = pick(meta?)?;
    let cleaned = value.trim();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{ScorePayload, TempoMarker};
    use std::fs;

    #[test]
    fn simple_scale_fixture() {
        let path = format!(
            "{}/../fixtures/simple-scale.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let raw = fs::read_to_string(path).expect("fixture");
        let payload: ScorePayload = serde_json::from_str(&raw).expect("json");
        let timeline = build_timeline(payload).expect("timeline");
        assert_eq!(timeline.notes.len(), 5);
        assert!((timeline.notes[0].start_ms - 0.0).abs() < 1e-6);
        assert!((timeline.notes[1].start_ms - 500.0).abs() < 1e-3);
    }

    #[test]
    fn tempo_change_is_slower_after_marker() {
        let payload = ScorePayload {
            r#type: Some(MSG_SCORE.into()),
            bpm: Some(120.0),
            tempo_map: vec![
                TempoMarker {
                    offset_ql: 0.0,
                    bpm: 120.0,
                },
                TempoMarker {
                    offset_ql: 4.0,
                    bpm: 90.0,
                },
            ],
            notes: vec![
                ScoreNoteInput {
                    pitch: 60,
                    offset_ql: 3.0,
                    duration_ql: 1.0,
                    track: 0,
                    staff: 0,
                    finger: None,
                },
                ScoreNoteInput {
                    pitch: 62,
                    offset_ql: 5.0,
                    duration_ql: 1.0,
                    track: 0,
                    staff: 0,
                    finger: None,
                },
            ],
            meta: None,
        };
        let timeline = build_timeline(payload).expect("timeline");
        let before = timeline.notes[0].start_ms;
        let after = timeline.notes[1].start_ms;
        // One quarter at 90 BPM is ~666 ms vs 500 ms at 120 BPM.
        assert!(after - before > 600.0);
    }

    #[test]
    fn rejects_unsupported_type() {
        let payload = ScorePayload {
            r#type: Some("hello".into()),
            bpm: Some(120.0),
            tempo_map: vec![],
            notes: vec![],
            meta: None,
        };
        assert!(matches!(
            build_timeline(payload),
            Err(CadenzaError::UnsupportedType(_))
        ));
    }

    #[test]
    fn rejects_invalid_bpm() {
        let payload = ScorePayload {
            r#type: Some(MSG_SCORE.into()),
            bpm: Some(-10.0),
            tempo_map: vec![],
            notes: vec![],
            meta: None,
        };
        assert!(matches!(
            build_timeline(payload),
            Err(CadenzaError::InvalidBpm)
        ));
    }

    #[test]
    fn extracts_composer_from_meta() {
        let payload = ScorePayload {
            r#type: Some(MSG_SCORE.into()),
            bpm: Some(120.0),
            tempo_map: vec![],
            notes: vec![ScoreNoteInput {
                pitch: 60,
                offset_ql: 0.0,
                duration_ql: 1.0,
                track: 0,
                staff: 0,
                finger: None,
            }],
            meta: Some(crate::protocol::ScoreMeta {
                title: Some("Test".into()),
                composer: Some("  Bach  ".into()),
                parts: Some(1),
            }),
        };
        let timeline = build_timeline(payload).expect("timeline");
        assert_eq!(timeline.title.as_deref(), Some("Test"));
        assert_eq!(timeline.composer.as_deref(), Some("Bach"));
        assert!(timeline.duration_ms > 0.0);
    }

    #[test]
    fn all_fixtures_build_timeline() {
        let names = [
            "simple-scale.json",
            "fingering.json",
            "chords.json",
            "tempo-change.json",
            "two-staves.json",
            "large-score.json",
        ];
        for name in names {
            let path = format!("{}/../fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
            let raw = fs::read_to_string(&path).unwrap_or_else(|_| panic!("read {path}"));
            let payload: ScorePayload = serde_json::from_str(&raw).expect(name);
            let timeline = build_timeline(payload).expect(name);
            assert!(!timeline.notes.is_empty(), "{name} has notes");
            assert!(timeline.duration_ms > 0.0, "{name} duration");
            assert!(
                timeline.notes.iter().all(|n| n.finger.is_some()),
                "{name} fingers assigned"
            );
        }
    }
}
