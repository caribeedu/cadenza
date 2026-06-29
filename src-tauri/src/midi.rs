use midir::{MidiInput, MidiInputConnection};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MidiMessage {
    NoteOn { pitch: u8, velocity: u8 },
    NoteOff { pitch: u8 },
}

pub struct MidiEngine {
    connection: Option<MidiInputConnection<()>>,
}

impl MidiEngine {
    pub fn new() -> Self {
        Self {
            connection: None,
        }
    }

    pub fn is_connected(&self) -> bool {
        self.connection.is_some()
    }

    pub fn disconnect(&mut self) {
        self.connection = None;
    }

    pub fn connect<F>(&mut self, port_name: &str, mut on_message: F) -> Result<(), String>
    where
        F: FnMut(MidiMessage) + Send + 'static,
    {
        self.disconnect();
        let midi_in = MidiInput::new("cadenza-midi").map_err(|e| e.to_string())?;
        let port = find_port(&midi_in, port_name)?;
        let conn = midi_in
            .connect(
                &port,
                "cadenza-input",
                move |_timestamp, message, _| {
                    if let Some(msg) = parse_midi_message(message) {
                        on_message(msg);
                    }
                },
                (),
            )
            .map_err(|e| e.to_string())?;
        self.connection = Some(conn);
        Ok(())
    }
}

impl Default for MidiEngine {
    fn default() -> Self {
        Self::new()
    }
}

pub fn list_input_ports() -> Vec<String> {
    let Ok(midi_in) = MidiInput::new("cadenza-port-scan") else {
        return Vec::new();
    };
    midi_in
        .ports()
        .iter()
        .filter_map(|port| midi_in.port_name(port).ok())
        .collect()
}

fn find_port(midi_in: &MidiInput, name: &str) -> Result<midir::MidiInputPort, String> {
    midi_in
        .ports()
        .iter()
        .find(|port| midi_in.port_name(port).ok().as_deref() == Some(name))
        .cloned()
        .ok_or_else(|| format!("MIDI port not found: {name}"))
}

pub fn parse_midi_message(message: &[u8]) -> Option<MidiMessage> {
    if message.len() < 3 {
        return None;
    }
    let status = message[0] & 0xF0;
    let pitch = message[1];
    let velocity = message[2];
    match status {
        0x90 if velocity > 0 => Some(MidiMessage::NoteOn {
            pitch,
            velocity,
        }),
        0x90 | 0x80 => Some(MidiMessage::NoteOff { pitch }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_note_on() {
        assert_eq!(
            parse_midi_message(&[0x90, 60, 100]),
            Some(MidiMessage::NoteOn {
                pitch: 60,
                velocity: 100
            })
        );
    }

    #[test]
    fn note_on_velocity_zero_is_note_off() {
        assert_eq!(
            parse_midi_message(&[0x90, 60, 0]),
            Some(MidiMessage::NoteOff { pitch: 60 })
        );
    }

    #[test]
    fn parses_note_off() {
        assert_eq!(
            parse_midi_message(&[0x80, 62, 0]),
            Some(MidiMessage::NoteOff { pitch: 62 })
        );
    }

    #[test]
    fn ignores_other_messages() {
        assert_eq!(parse_midi_message(&[0xB0, 7, 100]), None);
    }
}
