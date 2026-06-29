use std::collections::BTreeMap;

use crate::performer_fingering::{compute_fingering, Hand, LayerInput};
use crate::protocol::{FingeringProgressEvent, TimelineNote};

const ONSET_EPS_MS: f64 = 1.0;
const MIDI_ALG_LO: i32 = 21;
const MIDI_ALG_HI: i32 = 108;

pub fn assign_fingerings_if_needed(notes: Vec<TimelineNote>) -> Vec<TimelineNote> {
    assign_fingerings_with_progress(notes, |_| {})
}

pub fn assign_fingerings_with_progress(
    mut notes: Vec<TimelineNote>,
    mut progress: impl FnMut(FingeringProgressEvent),
) -> Vec<TimelineNote> {
    if notes.is_empty() || !notes.iter().any(|n| n.finger.is_none()) {
        return notes;
    }

    let mut by_staff: BTreeMap<i32, Vec<usize>> = BTreeMap::new();
    for (i, n) in notes.iter().enumerate() {
        by_staff.entry(n.staff).or_default().push(i);
    }

    let mut jobs = Vec::new();
    for (&staff, idxs) in &by_staff {
        if let Some((hand, layer_inputs, eligible_groups)) = collect_staff_job(&notes, staff, idxs) {
            jobs.push((hand, layer_inputs, eligible_groups));
        }
    }

    let total_jobs = jobs.len();
    for (job_index, (hand, layer_inputs, eligible_groups)) in jobs.iter().enumerate() {
        progress(FingeringProgressEvent {
            done: job_index,
            total: total_jobs,
            hand: hand.as_str().to_string(),
        });

        let computed = compute_fingering(layer_inputs, *hand);
        if computed.len() != eligible_groups.len() {
            continue;
        }

        for (gr, layer) in eligible_groups.iter().zip(computed.iter()) {
            let mut gr_sorted = gr.clone();
            gr_sorted.sort_by_key(|&i| notes[i].pitch);

            if gr_sorted.len() != layer.notes.len() || layer.notes.len() != layer.fingers.len() {
                continue;
            }
            if gr_sorted
                .iter()
                .zip(layer.notes.iter())
                .any(|(&i, p)| notes[i].pitch != *p)
            {
                continue;
            }

            for (&gi, &finger) in gr_sorted.iter().zip(layer.fingers.iter()) {
                if notes[gi].finger.is_none() {
                    notes[gi].finger = Some(finger);
                }
            }
        }
    }

    if total_jobs > 0 {
        let last_hand = jobs.last().map(|(h, _, _)| h.as_str()).unwrap_or("right");
        progress(FingeringProgressEvent {
            done: total_jobs,
            total: total_jobs,
            hand: last_hand.to_string(),
        });
    }

    notes
}

fn hand_for_staff(staff: i32) -> Hand {
    if staff == 1 {
        Hand::Left
    } else {
        Hand::Right
    }
}

fn build_layer_input(group: &[&TimelineNote]) -> LayerInput {
    let ordered: Vec<&TimelineNote> = {
        let mut g = group.to_vec();
        g.sort_by_key(|n| n.pitch);
        g
    };
    let pitches: Vec<i32> = ordered.iter().map(|n| n.pitch).collect();
    let fingers: Vec<Option<i32>> = ordered.iter().map(|n| n.finger).collect();
    if fingers.iter().all(|f| f.is_some()) {
        LayerInput::WithFingers {
            notes: pitches,
            fingers: fingers.into_iter().map(|f| f.unwrap()).collect(),
        }
    } else {
        LayerInput::Notes(pitches)
    }
}

fn collect_staff_job(
    notes: &[TimelineNote],
    staff: i32,
    idxs: &[usize],
) -> Option<(Hand, Vec<LayerInput>, Vec<Vec<usize>>)> {
    let mut pairs: Vec<(usize, &TimelineNote)> = idxs.iter().map(|&i| (i, &notes[i])).collect();
    pairs.sort_by(|a, b| {
        a.1.start_ms
            .partial_cmp(&b.1.start_ms)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.1.pitch.cmp(&b.1.pitch))
    });
    if pairs.is_empty() {
        return None;
    }

    let mut groups: Vec<Vec<(usize, &TimelineNote)>> = Vec::new();
    let mut cur = vec![pairs[0]];
    for p in pairs.into_iter().skip(1) {
        if (p.1.start_ms - cur[0].1.start_ms).abs() <= ONSET_EPS_MS {
            cur.push(p);
        } else {
            groups.push(cur);
            cur = vec![p];
        }
    }
    groups.push(cur);

    let mut layer_inputs = Vec::new();
    let mut eligible_groups = Vec::new();

    for gr in groups {
        let needs = gr.iter().any(|(i, _)| notes[*i].finger.is_none());
        if !needs {
            continue;
        }
        let pitches: Vec<i32> = gr.iter().map(|(_, n)| n.pitch).collect();
        if !pitches
            .iter()
            .all(|&p| (MIDI_ALG_LO..=MIDI_ALG_HI).contains(&p))
        {
            continue;
        }
        let note_refs: Vec<&TimelineNote> = gr.iter().map(|(_, n)| *n).collect();
        layer_inputs.push(build_layer_input(&note_refs));
        eligible_groups.push(gr.into_iter().map(|(i, _)| i).collect());
    }

    if layer_inputs.is_empty() {
        return None;
    }

    Some((hand_for_staff(staff), layer_inputs, eligible_groups))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn note(
        id: i32,
        pitch: i32,
        start_ms: f64,
        staff: i32,
        finger: Option<i32>,
    ) -> TimelineNote {
        TimelineNote {
            id,
            pitch,
            start_ms,
            duration_ms: 500.0,
            track: 0,
            staff,
            finger,
        }
    }

    #[test]
    fn editorial_finger_preserved() {
        let notes = assign_fingerings_if_needed(vec![
            note(0, 60, 0.0, 0, Some(2)),
            note(1, 64, 500.0, 0, None),
        ]);
        assert_eq!(notes[0].finger, Some(2));
        assert_eq!(notes[1].finger, Some(1));
    }

    #[test]
    fn left_hand_staff_gets_fingering() {
        let notes = assign_fingerings_if_needed(vec![
            note(0, 48, 0.0, 1, None),
            note(1, 52, 500.0, 1, None),
        ]);
        assert!(notes.iter().all(|n| n.finger.is_some()));
        assert_eq!(notes[0].finger, Some(3));
        assert_eq!(notes[1].finger, Some(1));
    }

    #[test]
    fn fingering_fixture_all_filled() {
        let path = format!(
            "{}/../fixtures/simple-scale.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let raw = fs::read_to_string(path).expect("fixture");
        let payload: crate::protocol::ScorePayload = serde_json::from_str(&raw).expect("json");
        let timeline = crate::timeline::build_timeline(payload).expect("timeline");
        assert!(timeline.notes.iter().all(|n| n.finger.is_some()));
        assert!(timeline
            .notes
            .iter()
            .all(|n| (1..=5).contains(&n.finger.unwrap())));
    }

    #[test]
    fn progress_callback_reports_hands() {
        let mut events = Vec::new();
        let notes = vec![
            note(0, 60, 0.0, 0, None),
            note(1, 48, 0.0, 1, None),
        ];
        assign_fingerings_with_progress(notes, |e| events.push(e));
        assert!(events.len() >= 2);
        assert_eq!(events.last().unwrap().done, events.last().unwrap().total);
        let hands: std::collections::HashSet<_> = events.iter().map(|e| e.hand.as_str()).collect();
        assert!(hands.contains("left"));
        assert!(hands.contains("right"));
    }
}
