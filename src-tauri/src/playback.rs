use std::time::Instant;

#[derive(Debug, Clone)]
pub struct PlaybackClock {
    position_ms: f64,
    speed: f64,
    running: bool,
    last_tick: Option<Instant>,
}

impl Default for PlaybackClock {
    fn default() -> Self {
        Self {
            position_ms: 0.0,
            speed: 1.0,
            running: false,
            last_tick: None,
        }
    }
}

impl PlaybackClock {
    pub fn position_ms(&mut self) -> f64 {
        self.sync();
        self.position_ms
    }

    pub fn speed(&self) -> f64 {
        self.speed
    }

    pub fn set_speed(&mut self, speed: f64) {
        self.sync();
        self.speed = speed;
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    pub fn start(&mut self) {
        self.running = true;
        self.last_tick = Some(Instant::now());
    }

    pub fn pause(&mut self) {
        self.sync();
        self.running = false;
        self.last_tick = None;
    }

    pub fn stop(&mut self) {
        self.running = false;
        self.last_tick = None;
        self.position_ms = 0.0;
    }

    pub fn seek(&mut self, position_ms: f64) {
        self.position_ms = position_ms.max(0.0);
        self.last_tick = if self.running {
            Some(Instant::now())
        } else {
            None
        };
    }

    fn sync(&mut self) {
        if !self.running {
            return;
        }
        let now = Instant::now();
        if let Some(last) = self.last_tick {
            let delta_ms = now.duration_since(last).as_secs_f64() * 1000.0 * self.speed;
            self.position_ms += delta_ms;
        }
        self.last_tick = Some(now);
    }
}
