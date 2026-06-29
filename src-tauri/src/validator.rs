use crate::protocol::TimelineNote;

pub const DEFAULT_TOLERANCE_MS: f64 = 130.0;
pub const EARLY_TOLERANCE_FACTOR: f64 = 0.82;
pub const LATE_TOLERANCE_FACTOR: f64 = 1.38;

#[derive(Debug, Clone, PartialEq)]
pub struct ValidationResult {
    pub correct: bool,
    pub played_pitch: i32,
    pub played_time_ms: f64,
    pub expected: Option<TimelineNote>,
    pub delta_ms: Option<f64>,
}

impl ValidationResult {
    pub fn expected_id(&self) -> Option<i32> {
        self.expected.as_ref().map(|n| n.id)
    }
}

pub struct Validator {
    notes: Vec<TimelineNote>,
    tolerance_ms: f64,
    consumed: std::collections::HashSet<usize>,
    active_hits: std::collections::HashMap<usize, (f64, TimelineNote)>,
}

impl Validator {
    pub fn new(notes: Vec<TimelineNote>, tolerance_ms: f64) -> Result<Self, String> {
        if tolerance_ms < 0.0 {
            return Err("tolerance_ms must be >= 0".into());
        }
        Ok(Self {
            notes,
            tolerance_ms,
            consumed: std::collections::HashSet::new(),
            active_hits: std::collections::HashMap::new(),
        })
    }

    pub fn tolerance_ms(&self) -> f64 {
        self.tolerance_ms
    }

    pub fn set_tolerance_ms(&mut self, value: f64) -> Result<(), String> {
        if value < 0.0 {
            return Err("tolerance_ms must be >= 0".into());
        }
        self.tolerance_ms = value;
        Ok(())
    }

    pub fn reset(&mut self) {
        self.consumed.clear();
        self.active_hits.clear();
    }

    pub fn validate(&mut self, pitch: i32, played_time_ms: f64) -> ValidationResult {
        self.purge_expired_active_hits(played_time_ms);

        if let Some(idx) = self.find_match(pitch, played_time_ms) {
            self.consumed.insert(idx);
            let note = self.notes[idx].clone();
            self.active_hits.insert(idx, (played_time_ms, note.clone()));
            return ValidationResult {
                correct: true,
                played_pitch: pitch,
                played_time_ms,
                expected: Some(note.clone()),
                delta_ms: Some(note.start_ms - played_time_ms),
            };
        }

        if let Some((_hit_time, note)) = self.violated_active_hit(played_time_ms) {
            return ValidationResult {
                correct: false,
                played_pitch: pitch,
                played_time_ms,
                expected: Some(note.clone()),
                delta_ms: Some(note.start_ms - played_time_ms),
            };
        }

        if let Some(note) = self.closest_unconsumed_within_tolerance(played_time_ms) {
            return ValidationResult {
                correct: false,
                played_pitch: pitch,
                played_time_ms,
                expected: Some(note.clone()),
                delta_ms: Some(note.start_ms - played_time_ms),
            };
        }

        ValidationResult {
            correct: false,
            played_pitch: pitch,
            played_time_ms,
            expected: None,
            delta_ms: None,
        }
    }

    fn within_onset_window(&self, played_time_ms: f64, onset_ms: f64) -> bool {
        let delta = played_time_ms - onset_ms;
        let early = self.tolerance_ms * EARLY_TOLERANCE_FACTOR;
        let late = self.tolerance_ms * LATE_TOLERANCE_FACTOR;
        (-early..=late).contains(&delta)
    }

    fn find_match(&self, pitch: i32, played_time_ms: f64) -> Option<usize> {
        let mut best_idx = None;
        let mut best_abs_delta = None;
        for (idx, note) in self.notes.iter().enumerate() {
            if self.consumed.contains(&idx) || note.pitch != pitch {
                continue;
            }
            if !self.within_onset_window(played_time_ms, note.start_ms) {
                continue;
            }
            let delta = (note.start_ms - played_time_ms).abs();
            if best_abs_delta.is_none_or(|best| delta < best) {
                best_abs_delta = Some(delta);
                best_idx = Some(idx);
            }
        }
        best_idx
    }

    fn closest_unconsumed_within_tolerance(&self, played_time_ms: f64) -> Option<TimelineNote> {
        let mut best_note = None;
        let mut best_abs_delta = None;
        for (idx, note) in self.notes.iter().enumerate() {
            if self.consumed.contains(&idx) {
                continue;
            }
            if !self.within_onset_window(played_time_ms, note.start_ms) {
                continue;
            }
            let delta = (note.start_ms - played_time_ms).abs();
            if best_abs_delta.is_none_or(|best| delta < best) {
                best_abs_delta = Some(delta);
                best_note = Some(note.clone());
            }
        }
        best_note
    }

    fn purge_expired_active_hits(&mut self, now_ms: f64) {
        let expired: Vec<usize> = self
            .active_hits
            .iter()
            .filter(|(_, (_, note))| now_ms >= note.start_ms + note.duration_ms)
            .map(|(idx, _)| *idx)
            .collect();
        for idx in expired {
            self.active_hits.remove(&idx);
        }
    }

    fn violated_active_hit(&self, played_time_ms: f64) -> Option<(f64, TimelineNote)> {
        let mut best: Option<(f64, TimelineNote)> = None;
        let mut best_end = None;
        let mut indices: Vec<usize> = self.active_hits.keys().copied().collect();
        indices.sort_unstable();
        for idx in indices {
            let (hit_time, note) = self.active_hits.get(&idx)?;
            let end = note.start_ms + note.duration_ms;
            if *hit_time <= played_time_ms
                && played_time_ms <= end
                && best_end.is_none_or(|current| end > current)
            {
                best_end = Some(end);
                best = Some((*hit_time, note.clone()));
            }
        }
        best
    }
}

pub fn unvalidated_reason(has_validator: bool, playing: bool, paused: bool) -> Option<&'static str> {
    if !has_validator {
        return Some("no_score");
    }
    if paused {
        return Some("paused");
    }
    if !playing {
        return Some("not_started");
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_notes() -> Vec<TimelineNote> {
        vec![
            TimelineNote {
                id: 0,
                pitch: 60,
                start_ms: 0.0,
                duration_ms: 500.0,
                track: 0,
                staff: 0,
                finger: None,
            },
            TimelineNote {
                id: 1,
                pitch: 62,
                start_ms: 500.0,
                duration_ms: 500.0,
                track: 0,
                staff: 0,
                finger: None,
            },
            TimelineNote {
                id: 2,
                pitch: 60,
                start_ms: 1000.0,
                duration_ms: 500.0,
                track: 0,
                staff: 0,
                finger: None,
            },
        ]
    }

    #[test]
    fn correct_note_within_tolerance() {
        let mut v = Validator::new(sample_notes(), 100.0).unwrap();
        let result = v.validate(60, 40.0);
        assert!(result.correct);
        assert_eq!(result.expected.as_ref().unwrap().start_ms, 0.0);
        assert_eq!(result.delta_ms, Some(-40.0));
    }

    #[test]
    fn each_note_matched_once() {
        let mut v = Validator::new(sample_notes(), 100.0).unwrap();
        assert!(v.validate(60, 0.0).correct);
        assert!(!v.validate(60, 50.0).correct);
    }

    #[test]
    fn late_press_within_asymmetric_window_hits() {
        let mut v = Validator::new(sample_notes(), 100.0).unwrap();
        assert!(v.validate(60, 130.0).correct);
    }

    #[test]
    fn boundary_press_targets_next_note() {
        let mut v = Validator::new(sample_notes(), 100.0).unwrap();
        v.validate(60, 0.0);
        let boundary = v.validate(63, 500.0);
        assert!(!boundary.correct);
        assert_eq!(boundary.expected_id(), Some(1));
    }
}
