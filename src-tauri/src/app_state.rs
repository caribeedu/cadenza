use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};

use crate::error::CadenzaError;
use crate::midi::{self, MidiEngine, MidiMessage};
use crate::playback::PlaybackClock;
use crate::protocol::{
    AppErrorEvent, AppStatus, MidiNoteEvent, MidiNoteOffEvent, MidiPortsChanged, PlaybackState,
    ScoreAck, ScorePayload, Timeline, ValidationResultEvent,
};
use crate::timeline::build_timeline_with_progress;
use crate::validator::{unvalidated_reason, Validator, DEFAULT_TOLERANCE_MS};

struct InnerState {
    timeline: Option<Timeline>,
    validator: Option<Validator>,
    midi_engine: MidiEngine,
    midi_selected: Option<String>,
    playing: bool,
    paused: bool,
    clock: PlaybackClock,
    tolerance_ms: f64,
}

impl Default for InnerState {
    fn default() -> Self {
        Self {
            timeline: None,
            validator: None,
            midi_engine: MidiEngine::new(),
            midi_selected: None,
            playing: false,
            paused: false,
            clock: PlaybackClock::default(),
            tolerance_ms: DEFAULT_TOLERANCE_MS,
        }
    }
}

pub struct AppState {
    inner: Mutex<InnerState>,
    app: AppHandle,
}

impl AppState {
    pub fn new(app: AppHandle) -> Self {
        Self {
            inner: Mutex::new(InnerState::default()),
            app,
        }
    }

    pub fn refresh_midi_ports(&self) {
        let ports = midi::list_input_ports();
        let selected = self.inner.lock().midi_selected.clone();
        let _ = self.app.emit(
            "midi_ports_changed",
            &MidiPortsChanged { ports, selected },
        );
    }

    pub fn apply_score(&self, payload: ScorePayload) -> Result<ScoreAck, CadenzaError> {
        let timeline = build_timeline_with_progress(payload, |progress| {
            let _ = self.app.emit("fingering_progress", &progress);
        })?;
        let validator = Validator::new(timeline.notes.clone(), DEFAULT_TOLERANCE_MS)
            .map_err(CadenzaError::Message)?;

        let ack = ScoreAck {
            ok: true,
            notes: timeline.notes.len(),
            bpm: timeline.bpm,
            duration_ms: timeline.duration_ms,
        };

        {
            let mut state = self.inner.lock();
            state.timeline = Some(timeline.clone());
            state.validator = Some(validator);
            state.playing = false;
            state.paused = false;
            state.clock.stop();
        }

        let _ = self.app.emit("score_loaded", &timeline);
        crate::file_log::write_event(
            "score_received",
            &format!("notes={} duration_ms={:.0}", ack.notes, ack.duration_ms),
        );
        self.emit_playback_changed();
        Ok(ack)
    }

    pub fn emit_app_error(&self, code: &str, message: &str, recoverable: bool) {
        crate::file_log::write_event("app_error", &format!("{code}: {message}"));
        let _ = self.app.emit(
            "app_error",
            &AppErrorEvent {
                code: code.into(),
                message: message.into(),
                recoverable,
            },
        );
    }

    pub fn timeline(&self) -> Option<Timeline> {
        self.inner.lock().timeline.clone()
    }

    pub fn status(&self) -> AppStatus {
        let mut state = self.inner.lock();
        let position_ms = state.clock.position_ms();
        let (note_count, duration_ms) = match &state.timeline {
            Some(timeline) => (timeline.notes.len(), timeline.duration_ms),
            None => (0, 0.0),
        };

        AppStatus {
            has_score: state.timeline.is_some(),
            note_count,
            duration_ms,
            midi_selected: state.midi_selected.clone(),
            playing: state.playing,
            paused: state.paused,
            position_ms,
            speed: state.clock.speed(),
            tolerance_ms: state.tolerance_ms,
        }
    }

    pub fn play(&self) -> Result<(), String> {
        let mut state = self.inner.lock();
        if state.timeline.is_none() {
            return Err("no_score".into());
        }
        state.playing = true;
        state.paused = false;
        state.clock.start();
        drop(state);
        crate::file_log::write_event("playback_started", "");
        self.emit_playback_changed();
        Ok(())
    }

    pub fn pause(&self) -> Result<(), String> {
        let mut state = self.inner.lock();
        if !state.playing || state.paused {
            return Ok(());
        }
        state.playing = false;
        state.paused = true;
        state.clock.pause();
        drop(state);
        crate::file_log::write_event("playback_paused", "");
        self.emit_playback_changed();
        Ok(())
    }

    pub fn resume(&self) -> Result<(), String> {
        let mut state = self.inner.lock();
        if !state.paused {
            return Ok(());
        }
        state.playing = true;
        state.paused = false;
        state.clock.start();
        drop(state);
        crate::file_log::write_event("playback_resumed", "");
        self.emit_playback_changed();
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut state = self.inner.lock();
        state.playing = false;
        state.paused = false;
        state.clock.stop();
        if let Some(validator) = state.validator.as_mut() {
            validator.reset();
        }
        drop(state);
        crate::file_log::write_event("playback_stopped", "");
        self.emit_playback_changed();
        Ok(())
    }

    pub fn seek(&self, position_ms: f64) -> Result<(), String> {
        let mut state = self.inner.lock();
        if state.timeline.is_none() {
            return Err("no_score".into());
        }
        let max_ms = state
            .timeline
            .as_ref()
            .map(|t| t.duration_ms)
            .unwrap_or(0.0);
        state.clock.seek(position_ms.clamp(0.0, max_ms));
        drop(state);
        self.emit_playback_changed();
        Ok(())
    }

    pub fn set_speed(&self, speed: f64) -> Result<(), String> {
        if !speed.is_finite() || speed <= 0.0 {
            return Err("speed must be positive".into());
        }
        self.inner.lock().clock.set_speed(speed);
        self.emit_playback_changed();
        Ok(())
    }

    pub fn set_tolerance(&self, tolerance_ms: f64) -> Result<(), String> {
        let mut state = self.inner.lock();
        state.tolerance_ms = tolerance_ms;
        if let Some(validator) = state.validator.as_mut() {
            validator.set_tolerance_ms(tolerance_ms)?;
        }
        Ok(())
    }

    pub fn select_midi(self: &Arc<Self>, port_name: String) -> Result<(), String> {
        {
            let mut state = self.inner.lock();
            state.midi_selected = Some(port_name.clone());
            state.midi_engine.disconnect();
        }

        let app = Arc::clone(self);
        let mut engine = MidiEngine::new();
        engine.connect(&port_name, move |message| match message {
            MidiMessage::NoteOn { pitch, velocity } => app.on_midi_note_on(pitch, velocity),
            MidiMessage::NoteOff { pitch } => app.on_midi_note_off(pitch),
        })?;

        self.inner.lock().midi_engine = engine;
        self.refresh_midi_ports();
        Ok(())
    }

    pub fn on_midi_note_on(&self, pitch: u8, velocity: u8) {
        let (played_time_ms, playing, paused, has_validator) = {
            let mut state = self.inner.lock();
            let played_time_ms = state.clock.position_ms();
            (
                played_time_ms,
                state.playing,
                state.paused,
                state.validator.is_some(),
            )
        };

        let _ = self.app.emit(
            "midi_note",
            &MidiNoteEvent {
                pitch: pitch as i32,
                velocity: velocity as i32,
                played_time_ms,
            },
        );

        if unvalidated_reason(has_validator, playing, paused).is_some() {
            return;
        }

        let _ = self.validate_note_at(pitch as i32, Some(played_time_ms));
    }

    pub fn on_midi_note_off(&self, pitch: u8) {
        let _ = self.app.emit(
            "midi_note_off",
            &MidiNoteOffEvent {
                pitch: pitch as i32,
            },
        );
    }

    pub fn validate_note_at(
        &self,
        pitch: i32,
        played_time_ms: Option<f64>,
    ) -> Result<ValidationResultEvent, String> {
        let mut state = self.inner.lock();
        let playing = state.playing;
        let paused = state.paused;
        let has_validator = state.validator.is_some();
        if let Some(reason) = unvalidated_reason(has_validator, playing, paused) {
            return Err(reason.into());
        }

        let played_time_ms = played_time_ms.unwrap_or_else(|| state.clock.position_ms());
        let validator = state.validator.as_mut().ok_or("no_score")?;
        let result = validator.validate(pitch, played_time_ms);
        let event = ValidationResultEvent {
            correct: result.correct,
            played_pitch: result.played_pitch,
            played_time_ms: result.played_time_ms,
            expected_id: result.expected_id(),
            expected_pitch: result.expected.as_ref().map(|n| n.pitch),
            expected_time_ms: result.expected.as_ref().map(|n| n.start_ms),
            delta_ms: result.delta_ms,
        };
        let _ = self.app.emit("validation_result", &event);
        crate::file_log::write_event(
            "validation_result",
            &format!(
                "correct={} pitch={}",
                event.correct, event.played_pitch
            ),
        );
        Ok(event)
    }

    fn emit_playback_changed(&self) {
        let payload = {
            let mut state = self.inner.lock();
            PlaybackState {
                playing: state.playing,
                paused: state.paused,
                position_ms: state.clock.position_ms(),
                speed: state.clock.speed(),
            }
        };
        let _ = self.app.emit("playback_changed", &payload);
    }
}

pub type SharedAppState = Arc<AppState>;

pub fn spawn_playback_loop(state: SharedAppState) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(16));
        let should_emit = {
            let mut inner = state.inner.lock();
            if inner.playing && !inner.paused {
                inner.clock.position_ms();
                true
            } else {
                false
            }
        };
        if should_emit {
            state.emit_playback_changed();
        }
    });
}
