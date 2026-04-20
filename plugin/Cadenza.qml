//------------------------------------------------------------------------------
//  Cadenza · MuseScore 4 Plugin
//
//  Extracts pitch, duration (quarterLength) and offset (quarterLength) for
//  every note in the currently open score and streams the result as JSON
//  over HTTP POST to the Cadenza Python backend at
//  http://127.0.0.1:8765/score.
//
//  MuseScore 4 does NOT ship the Qt.WebSockets QML module on Windows or
//  macOS builds (see back-end TECH-DEBTS TD-05). ``XMLHttpRequest``
//  is always available in any QtQml runtime, so we use plain HTTP.
//
//  Nothing is written to disk.
//
//  Install:
//      Linux   ~/.local/share/MuseScore/MuseScore4/Plugins/Cadenza.qml
//      macOS   ~/Documents/MuseScore4/Plugins/Cadenza.qml
//      Windows %USERPROFILE%\Documents\MuseScore4\Plugins\Cadenza.qml
//  Then enable it from Plugins → Plugin Manager and launch via Plugins.
//------------------------------------------------------------------------------

import QtQuick 2.9
import MuseScore 3.0

MuseScore {
    id: root
    title: "Cadenza Sender"
    description: "POSTs the current score to the Cadenza backend over HTTP."
    version: "0.2.0"
    categoryCode: "composing-arranging-tools"
    requiresScore: true

    property string backendUrl: "http://127.0.0.1:8765/score"

    // Walk the score and collect every tempo annotation.
    //
    // Returns ``{ bpm, tempoMap }`` where:
    //   - ``bpm`` is the *initial* tempo (convenient scalar for the HUD
    //     and for a legacy backend that only understands a single tempo).
    //   - ``tempoMap`` is an array ``[{offset_ql, bpm}, ...]`` sorted by
    //     offset, covering every mid-piece tempo change. The backend
    //     inserts one MetronomeMark per entry so accelerando /
    //     ritardando / multi-section pieces get correct timing.
    //
    // MuseScore's ``Tempo.tempo`` is quarter-notes-per-second; multiply
    // by 60 for BPM. Entries with the same offset are deduplicated —
    // keep the last-seen marker at that offset, matching MuseScore's own
    // rendering precedence.
    function detectTempo(score) {
        var defaultBpm = 120.0;
        var tempoMap = [];
        var division = (typeof score.division === "number" && score.division > 0)
            ? score.division : 480;

        try {
            var cursor = score.newCursor();
            cursor.rewind(Cursor.SCORE_START);
            while (cursor.segment) {
                var annotations = cursor.segment.annotations;
                if (annotations) {
                    for (var i = 0; i < annotations.length; ++i) {
                        var a = annotations[i];
                        if (a && a.tempo) {
                            var offsetQL = cursor.tick / division;
                            var bpm = a.tempo * 60.0;
                            // Last-wins on equal offsets.
                            var replaced = false;
                            for (var j = tempoMap.length - 1; j >= 0; --j) {
                                if (Math.abs(tempoMap[j].offset_ql - offsetQL) < 1e-9) {
                                    tempoMap[j].bpm = bpm;
                                    replaced = true;
                                    break;
                                }
                            }
                            if (!replaced) {
                                tempoMap.push({ offset_ql: offsetQL, bpm: bpm });
                            }
                        }
                    }
                }
                cursor.next();
            }
        } catch (err) {
            console.log("[Cadenza] tempo detection failed:", err);
        }

        tempoMap.sort(function (a, b) { return a.offset_ql - b.offset_ql; });

        // Initial tempo = first map entry at offset 0, else the first
        // entry at all, else the default.
        var initialBpm = defaultBpm;
        if (tempoMap.length > 0) {
            initialBpm = tempoMap[0].bpm;
        }
        return { bpm: initialBpm, tempoMap: tempoMap };
    }

    function collectNotes(score) {
        var notes = [];
        var division = (typeof score.division === "number" && score.division > 0)
            ? score.division : 480;

        for (var partIdx = 0; partIdx < score.parts.length; ++partIdx) {
            var cursor = score.newCursor();
            cursor.track = partIdx * 4; // first staff, first voice of each part
            cursor.rewind(Cursor.SCORE_START);

            while (cursor.segment) {
                var el = cursor.element;
                if (el && el.type === Element.CHORD) {
                    var offsetQL = cursor.tick / division;
                    var durationQL = el.duration && el.duration.ticks
                        ? el.duration.ticks / division
                        : 0.0;
                    var chordNotes = el.notes;
                    for (var n = 0; n < chordNotes.length; ++n) {
                        var note = chordNotes[n];
                        if (note && typeof note.pitch === "number") {
                            notes.push({
                                pitch: note.pitch,
                                offset_ql: offsetQL,
                                duration_ql: durationQL,
                                track: partIdx
                            });
                        }
                    }
                }
                cursor.next();
            }
        }

        return notes;
    }

    function buildPayload() {
        if (!curScore) {
            return null;
        }
        var tempo = detectTempo(curScore);
        var notes = collectNotes(curScore);
        return {
            type: "score",
            bpm: tempo.bpm,
            tempo_map: tempo.tempoMap,
            notes: notes,
            meta: {
                title: curScore.title || "",
                composer: (curScore.composer !== undefined) ? curScore.composer : "",
                parts: curScore.parts.length
            }
        };
    }

    function sendPayload(payload) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", root.backendUrl);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== XMLHttpRequest.DONE) {
                return;
            }
            if (xhr.status === 200) {
                console.log("[Cadenza] score accepted by backend:", xhr.responseText);
            } else if (xhr.status === 0) {
                // status 0 in Qt's XHR means the connection failed before a
                // response line arrived (typically: backend not listening).
                console.log("[Cadenza] connection failed — is the backend running on",
                            root.backendUrl, "?");
            } else {
                console.log("[Cadenza] backend rejected payload:",
                            xhr.status, xhr.statusText, xhr.responseText);
            }
        };
        xhr.send(JSON.stringify(payload));
    }

    onRun: {
        var payload = buildPayload();
        if (payload === null) {
            console.log("[Cadenza] no score is open, aborting.");
            return;
        }
        console.log("[Cadenza] collected", payload.notes.length,
                    "notes @", payload.bpm, "BPM (",
                    payload.tempo_map.length, "tempo markers) → POSTing to",
                    root.backendUrl);
        sendPayload(payload);
    }
}
