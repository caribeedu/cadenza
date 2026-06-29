use std::sync::OnceLock;

const MOVE_CUTOFF: f64 = 7.5;
const NOTE_LO: u8 = 21;
const NOTE_HI: u8 = 108;
const TABLE_LEN: usize = 88 * 88 * 25;

const FINGER_DISTANCE: [[f64; 5]; 5] = [
    [0.0, 2.0, 3.5, 5.0, 7.0],
    [2.0, 0.0, 2.0, 3.5, 5.0],
    [3.5, 2.0, 0.0, 2.0, 3.5],
    [5.0, 3.5, 2.0, 0.0, 2.0],
    [7.0, 5.0, 3.5, 2.0, 0.0],
];

const MOVE_HASH: [f64; 25] = [
    0.0, 4.0, 4.5, 5.8, 7.0, 9.0, 11.0, 12.0, 12.9, 13.7, 14.5, 15.0, 15.4, 15.8, 16.2,
    16.5, 16.8, 17.1, 17.4, 17.7, 18.0, 18.3, 18.6, 18.9, 19.2,
];

const KEY_IS_BLACK: [bool; 12] = [
    false, true, false, true, false, false, true, false, true, false, true, false,
];

const ASC_THUMB_STRETCH: [[f64; 5]; 5] = [
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.95],
    [0.0, 0.0, 0.0, 1.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.95],
    [0.0, 0.95, 0.0, 0.0, 0.95],
];

const DESC_THUMB_STRETCH: [[f64; 5]; 5] = [
    [0.0, 1.0, 1.0, 0.9, 0.95],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
];

const FINGER_STRETCH: [[f64; 5]; 5] = [
    [0.8, 1.15, 1.4, 1.45, 1.6],
    [1.15, 0.6, 0.9, 1.15, 1.3],
    [1.4, 0.9, 0.6, 0.9, 1.15],
    [1.45, 1.15, 0.9, 0.7, 0.7],
    [1.6, 1.3, 1.15, 0.8, 0.6],
];

pub struct CostTables {
    pub right: Vec<f64>,
    pub left: Vec<f64>,
}

static COST_TABLES: OnceLock<CostTables> = OnceLock::new();

pub fn cost_tables() -> &'static CostTables {
    COST_TABLES.get_or_init(build_cost_tables)
}

fn build_cost_tables() -> CostTables {
    let mut right = vec![0.0; TABLE_LEN];
    let mut left = vec![0.0; TABLE_LEN];
    for f1 in 1..=5u8 {
        for n1 in NOTE_LO..=NOTE_HI {
            for f2 in 1..=5u8 {
                for n2 in NOTE_LO..=NOTE_HI {
                    let idx = table_index(n1, n2, f1, f2);
                    right[idx] = compute_right_hand_cost(n1, n2, f1, f2);
                    left[idx] = compute_left_hand_cost(n1, n2, f1, f2);
                }
            }
        }
    }
    CostTables { right, left }
}

pub fn table_index(n1: u8, n2: u8, f1: u8, f2: u8) -> usize {
    let n1i = (n1 - NOTE_LO) as usize;
    let n2i = (n2 - NOTE_LO) as usize;
    let f1i = (f1 - 1) as usize;
    let f2i = (f2 - 1) as usize;
    (n1i * 88 + n2i) * 25 + f1i * 5 + f2i
}

pub fn lookup_right(n1: i32, n2: i32, f1: i32, f2: i32) -> f64 {
    let tables = cost_tables();
    tables.right[table_index(n1 as u8, n2 as u8, f1 as u8, f2 as u8)]
}

pub fn lookup_left(n1: i32, n2: i32, f1: i32, f2: i32) -> f64 {
    let tables = cost_tables();
    tables.left[table_index(n1 as u8, n2 as u8, f1 as u8, f2 as u8)]
}

fn finger_distance(f1: i32, f2: i32) -> f64 {
    FINGER_DISTANCE[(f1 - 1) as usize][(f2 - 1) as usize]
}

fn finger_stretch(f1: i32, f2: i32) -> f64 {
    FINGER_STRETCH[(f1 - 1) as usize][(f2 - 1) as usize]
}

fn asc_thumb_stretch(f1: i32, f2: i32) -> f64 {
    ASC_THUMB_STRETCH[(f1 - 1) as usize][(f2 - 1) as usize]
}

fn desc_thumb_stretch(f1: i32, f2: i32) -> f64 {
    DESC_THUMB_STRETCH[(f1 - 1) as usize][(f2 - 1) as usize]
}

fn is_black(note: i32) -> bool {
    KEY_IS_BLACK[note.rem_euclid(12) as usize]
}

fn color_rules(n1: i32, n2: i32, f1: i32, f2: i32, finger_dist: f64) -> f64 {
    if !is_black(n1) && is_black(n2) {
        if f2 == 5 || f2 == 1 {
            return 4.0;
        }
        if finger_dist == 0.0 {
            return 4.0;
        }
    }
    if is_black(n1) && !is_black(n2) {
        if f1 == 5 || f1 == 1 {
            return 4.0;
        }
        if finger_dist == 0.0 {
            return -1.0;
        }
    }
    0.0
}

fn asc_move_formula(note_distance: f64, finger_dist: f64, n1: i32, n2: i32, f1: i32, f2: i32) -> f64 {
    let total_distance = (note_distance + finger_dist).ceil();
    if total_distance > 24.0 {
        return MOVE_HASH[24] + (total_distance - 24.0) / 5.0;
    }
    let idx = total_distance as usize;
    let mut cost = MOVE_HASH[idx];
    cost += color_rules(n1, n2, f1, f2, finger_dist);
    cost
}

fn desc_move_formula(note_distance: f64, finger_dist: f64, n1: i32, n2: i32, f1: i32, f2: i32) -> f64 {
    let total_distance = (note_distance - finger_dist).ceil();
    if total_distance > 24.0 {
        return MOVE_HASH[24] + (total_distance - 24.0) / 5.0;
    }
    let idx = total_distance.max(0.0) as usize;
    let mut cost = MOVE_HASH[idx];
    cost += color_rules(n1, n2, f1, f2, finger_dist);
    cost
}

fn thumb_cross_cost(x: f64) -> f64 {
    0.0002185873295 * x.powi(7)
        - 0.008611946279 * x.powi(6)
        + 0.1323250066 * x.powi(5)
        - 1.002729677 * x.powi(4)
        + 3.884106308 * x.powi(3)
        - 6.723075747 * x.powi(2)
        + 1.581196785 * x
        + 7.711241722
}

fn asc_thumb_cost(note_distance: f64, finger_dist: f64, n1: i32, n2: i32, f1: i32, f2: i32) -> f64 {
    let stretch = asc_thumb_stretch(f1, f2);
    let x = (note_distance + finger_dist) / stretch;
    if x > 10.0 {
        return asc_move_formula(note_distance, finger_dist, n1, n2, f1, f2);
    }
    let mut cost = thumb_cross_cost(x);
    if !is_black(n1) && is_black(n2) {
        cost += 8.0;
    }
    cost
}

fn desc_thumb_cost(note_distance: f64, finger_dist: f64, n1: i32, n2: i32, f1: i32, f2: i32) -> f64 {
    let stretch = desc_thumb_stretch(f1, f2);
    let x = (note_distance + finger_dist) / stretch;
    if x > 10.0 {
        return asc_move_formula(note_distance, finger_dist, n1, n2, f1, f2);
    }
    let mut cost = thumb_cross_cost(x);
    if is_black(n1) && !is_black(n2) {
        cost += 8.0;
    }
    cost
}

fn asc_desc_no_cross_cost(
    _note_distance: f64,
    finger_dist: f64,
    x: f64,
    n1: i32,
    n2: i32,
    f1: i32,
    f2: i32,
) -> f64 {
    fn cost_func(x: f64) -> f64 {
        -0.0000006589793725 * x.powi(10)
            - 0.000002336381414 * x.powi(9)
            + 0.00009925769823 * x.powi(8)
            + 0.0001763353131 * x.powi(7)
            - 0.004660305277 * x.powi(6)
            - 0.004290746384 * x.powi(5)
            + 0.06855725903 * x.powi(4)
            + 0.03719817227 * x.powi(3)
            + 0.4554696705 * x.powi(2)
            - 0.08305450359 * x
            + 0.3020594956
    }

    if x > 6.8 && x <= MOVE_CUTOFF {
        return cost_func(6.8) + (x - 6.8) * 3.0;
    }
    let mut cost = cost_func(x);
    cost += color_rules(n1, n2, f1, f2, finger_dist);
    cost
}

fn compute_right_hand_cost(n1: u8, n2: u8, f1: u8, f2: u8) -> f64 {
    let n1 = n1 as i32;
    let n2 = n2 as i32;
    let f1 = f1 as i32;
    let f2 = f2 as i32;
    let note_distance = (n2 - n1).abs() as f64;
    let finger_dist = finger_distance(f1, f2);

    if (note_distance > 0.0 && f2 - f1 == 0)
        || (n2 - n1 >= 0 && f2 - f1 < 0 && f2 != 1)
        || (n2 - n1 < 0 && f2 - f1 > 0 && f1 != 1)
    {
        asc_move_formula(note_distance, finger_dist, n1, n2, f1, f2)
    } else if n2 - n1 >= 0 && f2 - f1 < 0 && f2 == 1 {
        asc_thumb_cost(note_distance, finger_dist, n1, n2, f1, f2)
    } else if n2 - n1 < 0 && f1 == 1 && f2 != 1 {
        desc_thumb_cost(note_distance, finger_dist, n1, n2, f1, f2)
    } else {
        let stretch = finger_stretch(f1, f2);
        let x = (note_distance - finger_dist).abs() / stretch;
        if x > MOVE_CUTOFF {
            desc_move_formula(note_distance, finger_dist, n1, n2, f1, f2)
        } else {
            asc_desc_no_cross_cost(note_distance, finger_dist, x, n1, n2, f1, f2)
        }
    }
}

fn compute_left_hand_cost(n1: u8, n2: u8, f1: u8, f2: u8) -> f64 {
    let n1 = n1 as i32;
    let n2 = n2 as i32;
    let f1 = f1 as i32;
    let f2 = f2 as i32;
    let note_distance = (n2 - n1).abs() as f64;
    let finger_dist = finger_distance(f1, f2);

    if (note_distance > 0.0 && f2 - f1 == 0)
        || (n2 - n1 <= 0 && f2 - f1 < 0 && f2 != 1)
        || (n2 - n1 > 0 && f2 - f1 > 0 && f1 != 1)
    {
        asc_move_formula(note_distance, finger_dist, n1, n2, f1, f2)
    } else if n2 - n1 <= 0 && f2 - f1 < 0 && f2 == 1 {
        asc_thumb_cost(note_distance, finger_dist, n1, n2, f1, f2)
    } else if n2 - n1 >= 0 && f1 == 1 && f2 != 1 {
        desc_thumb_cost(note_distance, finger_dist, n1, n2, f1, f2)
    } else {
        let stretch = finger_stretch(f1, f2);
        let x = (note_distance - finger_dist).abs() / stretch;
        if x > MOVE_CUTOFF {
            desc_move_formula(note_distance, finger_dist, n1, n2, f1, f2)
        } else {
            asc_desc_no_cross_cost(note_distance, finger_dist, x, n1, n2, f1, f2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cost_table_matches_python_sample() {
        let tables = cost_tables();
        let idx = table_index(60, 64, 1, 2);
        assert!((tables.right[idx] - 2.177126333190899).abs() < 1e-6);
    }
}
