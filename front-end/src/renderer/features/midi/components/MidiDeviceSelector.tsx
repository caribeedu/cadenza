import { usePlayback } from "@app/providers/PlaybackProvider";
import { type ChangeEvent, type ReactElement, useCallback } from "react";

export function MidiDeviceSelector(): ReactElement {
  const { midiPort, midiPorts, refreshMidi, selectMidi } = usePlayback();

  const onChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      if (value) selectMidi(value);
    },
    [selectMidi],
  );

  return (
    <>
      <label className="field">
        <span>MIDI input</span>
        <select onChange={onChange} value={midiPort ?? ""}>
          {midiPorts.length === 0 ? (
            <option value="">(no MIDI devices found)</option>
          ) : (
            <>
              <option value="">(select device)</option>
              {midiPorts.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </>
          )}
        </select>
      </label>
      <button onClick={refreshMidi} type="button">
        Refresh
      </button>
    </>
  );
}
