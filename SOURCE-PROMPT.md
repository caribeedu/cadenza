## **Prompt for the AI**

**Project title:** Cadenza: A "Waterfall"-style piano learning system fed via a MuseScore plugin.

**Goal:** Develop a functional clone of Yousician/Simply Piano that runs locally. The system must capture scores open in MuseScore (via QML plugin), process that data in a Rust core (Tauri), and display it in a SolidJS + Three.js desktop UI where the user's MIDI input is validated in real time.

### **1. System architecture**

The system must be divided into three main components:

1. **Producer (MuseScore plugin):** A plugin written in QML/JavaScript that extracts notes, tempos, and measures from the active score and sends them as JSON over HTTP (`POST /score`).
2. **Controller (Rust core):** The app's "brain". It must serve HTTP ingest, process MIDI input (USB/Bluetooth), build the score timeline, and perform logical validation (compare played note vs expected note).
3. **Viewer (SolidJS UI):** A high-performance interface using Three.js to render the waterfall of notes at 60 FPS. The UI talks to the core via Tauri commands and events.

### **2. Technology stack and libraries**

* **Core:** Rust (Tauri 2).
  * axum: HTTP ingest on port 8765.
  * midir: MIDI input.
  * Custom timeline/validator (quarter-length offsets → milliseconds).
* **Frontend:** SolidJS + Vite + Three.js (Tauri webview).
* **Plugin:** QML (MuseScore 4.x API).

### **3. Detailed task specifications (execution order)**

#### **Phase 1: Handshake (communication)**

* Start an HTTP server in the Rust core that listens on `http://127.0.0.1:8765/score`.
* Create a basic MuseScore plugin (`.qml`) that POSTs score JSON to that endpoint.
* Configure the desktop UI to show connection/score status via Tauri events.

#### **Phase 2: Data extraction (the plugin)**

* The QML plugin must iterate over `curScore.parts`, accessing measures and segments.
* Extract: Pitch (MIDI number), Duration (ticks), and Offset (position in time).
* Convert this data to structured JSON and POST it when the user invokes the plugin.

#### **Phase 3: MIDI input engine (Rust)**

* Implement a routine to list MIDI devices and open the selected port (USB or Bluetooth).
* The core must process `note_on` / `note_off` messages and transform them into a format the validator understands.

#### **Phase 4: The validator and timeline**

* Convert score timings (based on rhythmic divisions / tempo map) into an absolute timeline (milliseconds).
* **Validation logic:** Create a function that receives the MIDI note and checks whether it matches the score note within a tolerance window (e.g. ±100ms).

#### **Phase 5: Waterfall visualization (SolidJS + Three.js)**

* Develop the rendering engine on WebGL/Canvas. Notes must descend vertically.
* Load the score timeline from the core and draw notes from it.
* Implement visual feedback: Notes turn green if played correctly and red if there is an error.

### **4. Critical requirements and extra notes**

* **Latency:** The absolute priority is low latency. Keep MIDI reading off the UI thread.
* **Synchronization:** Time "zero" must be defined when the user starts playback in the app.
* **Interface:** Include a MIDI device selector so the user can choose between USB or Bluetooth.
* **No intermediate files:** Data flow must be purely in memory; avoid saving `.midi` or `.xml` files to disk during execution.
