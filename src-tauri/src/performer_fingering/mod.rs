mod cost;

use std::sync::OnceLock;

use cost::{lookup_left, lookup_right};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Hand {
    Right,
    Left,
}

impl Hand {
    pub fn as_str(self) -> &'static str {
        match self {
            Hand::Right => "right",
            Hand::Left => "left",
        }
    }
}

#[derive(Debug, Clone)]
pub struct FingeringLayer {
    pub notes: Vec<i32>,
    pub fingers: Vec<i32>,
}

#[derive(Debug, Clone)]
pub enum LayerInput {
    Rest,
    Notes(Vec<i32>),
    WithFingers { notes: Vec<i32>, fingers: Vec<i32> },
}

#[derive(Clone)]
struct DpNode {
    notes: Vec<i32>,
    fingers: Vec<i32>,
    score: f64,
    best_prev: Option<usize>,
}

static FINGER_OPTIONS_RIGHT: OnceLock<Vec<Vec<Vec<i32>>>> = OnceLock::new();
static FINGER_OPTIONS_LEFT: OnceLock<Vec<Vec<Vec<i32>>>> = OnceLock::new();

fn finger_options(hand: Hand) -> &'static Vec<Vec<Vec<i32>>> {
    match hand {
        Hand::Right => FINGER_OPTIONS_RIGHT.get_or_init(|| build_all_finger_options(Hand::Right)),
        Hand::Left => FINGER_OPTIONS_LEFT.get_or_init(|| build_all_finger_options(Hand::Left)),
    }
}

fn build_all_finger_options(hand: Hand) -> Vec<Vec<Vec<i32>>> {
    let mut all = Vec::with_capacity(6);
    all.push(vec![]);
    for nb in 1..=5 {
        all.push(all_finger_options(nb, hand));
    }
    all
}

fn all_finger_options(nb_fingers: usize, hand: Hand) -> Vec<Vec<i32>> {
    let mut results = Vec::new();
    let finger_options = [1, 2, 3, 4, 5];

    fn walk(
        nb_fingers: usize,
        hand: Hand,
        current: &mut Vec<i32>,
        options: &[i32],
        results: &mut Vec<Vec<i32>>,
    ) {
        if current.len() == nb_fingers {
            let mut sorted = current.clone();
            sorted.sort_unstable();
            if hand == Hand::Left {
                sorted.reverse();
            }
            results.push(sorted);
            return;
        }
        for i in 0..options.len() {
            current.push(options[i]);
            walk(nb_fingers, hand, current, &options[..i], results);
            current.pop();
        }
    }

    let mut current = Vec::new();
    walk(nb_fingers, hand, &mut current, &finger_options, &mut results);
    results.sort();
    results
}

pub fn compute_fingering(inputs: &[LayerInput], hand: Hand) -> Vec<FingeringLayer> {
    let (notes, rests) = preprocess_inputs(inputs);
    if notes.is_empty() {
        return vec![];
    }

    let mut layers: Vec<Vec<DpNode>> = vec![vec![DpNode {
        notes: vec![],
        fingers: vec![],
        score: 0.0,
        best_prev: None,
    }]];

    for info in &notes {
        layers.push(make_layer(&info.notes, hand, info.fingers.as_deref()));
    }

    for layer_index in 1..layers.len() {
        let prev_layer = layers[layer_index - 1].clone();
        for current in &mut layers[layer_index] {
            let mut min_score = f64::INFINITY;
            let mut best_prev = None;
            for (prev_index, previous) in prev_layer.iter().enumerate() {
                let total_cost = previous.score + calc_cost(current, previous, hand);
                if total_cost < min_score {
                    min_score = total_cost;
                    best_prev = Some(prev_index);
                }
            }
            current.score = min_score;
            current.best_prev = best_prev;
        }
    }

    let last_layer = layers.last().expect("layers");
    let mut best_index = 0usize;
    for (i, node) in last_layer.iter().enumerate() {
        if node.score < last_layer[best_index].score {
            best_index = i;
        }
    }

    let mut path: Vec<FingeringLayer> = Vec::new();
    let mut layer_index = layers.len() - 1;
    let mut node_index = best_index;
    loop {
        let node = &layers[layer_index][node_index];
        path.push(FingeringLayer {
            notes: node.notes.clone(),
            fingers: node.fingers.clone(),
        });
        match node.best_prev {
            Some(prev) => {
                layer_index -= 1;
                node_index = prev;
            }
            None => break,
        }
    }
    path.reverse();
    path.remove(0);

    for rest_index in rests {
        path.insert(rest_index, FingeringLayer {
            notes: vec![],
            fingers: vec![],
        });
    }

    path
}

struct PreprocessedNote {
    notes: Vec<i32>,
    fingers: Option<Vec<i32>>,
}

fn preprocess_inputs(inputs: &[LayerInput]) -> (Vec<PreprocessedNote>, Vec<usize>) {
    let mut result = Vec::new();
    let mut rests = Vec::new();
    for entry in inputs.iter() {
        match entry {
            LayerInput::Rest => rests.push(result.len()),
            LayerInput::Notes(pitches) if pitches.is_empty() => rests.push(result.len()),
            LayerInput::Notes(pitches) => result.push(PreprocessedNote {
                notes: pitches.clone(),
                fingers: None,
            }),
            LayerInput::WithFingers { notes, fingers } => result.push(PreprocessedNote {
                notes: notes.clone(),
                fingers: Some(fingers.clone()),
            }),
        }
    }
    (result, rests)
}

fn make_layer(notes: &[i32], hand: Hand, fingers: Option<&[i32]>) -> Vec<DpNode> {
    if let Some(fingers) = fingers {
        return vec![DpNode {
            notes: notes.to_vec(),
            fingers: fingers.to_vec(),
            score: 0.0,
            best_prev: None,
        }];
    }

    let options = &finger_options(hand)[notes.len()];
    options
        .iter()
        .map(|option| DpNode {
            notes: notes.to_vec(),
            fingers: option.clone(),
            score: 0.0,
            best_prev: None,
        })
        .collect()
}

fn calc_cost(current: &DpNode, previous: &DpNode, hand: Hand) -> f64 {
    let lookup = match hand {
        Hand::Right => lookup_right,
        Hand::Left => lookup_left,
    };

    let mut total = 0.0;
    for i in 0..current.notes.len() {
        let current_note = current.notes[i];
        let current_finger = current.fingers[i];

        if i < current.notes.len() - 1 {
            let next_note = current.notes[i + 1];
            let next_finger = current.fingers[i + 1];
            total += lookup(current_note, next_note, current_finger, next_finger);
        }

        for j in 0..previous.notes.len() {
            let previous_note = previous.notes[j];
            let previous_finger = previous.fingers[j];
            total += lookup(previous_note, current_note, previous_finger, current_finger);
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn editorial_right_hand_layer() {
        let inputs = vec![
            LayerInput::WithFingers {
                notes: vec![60],
                fingers: vec![2],
            },
            LayerInput::Notes(vec![64]),
        ];
        let result = compute_fingering(&inputs, Hand::Right);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].fingers, vec![2]);
        assert_eq!(result[1].fingers, vec![4]);
    }

    #[test]
    fn left_hand_two_notes() {
        let inputs = vec![
            LayerInput::Notes(vec![48]),
            LayerInput::Notes(vec![52]),
        ];
        let result = compute_fingering(&inputs, Hand::Left);
        assert_eq!(result[0].fingers, vec![3]);
        assert_eq!(result[1].fingers, vec![1]);
    }
}
