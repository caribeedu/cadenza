## **Prompt for the AI**

**Project title:** Cadenza: A "Waterfall"-style piano learning system fed via a MuseScore plugin.

**Goal:** Develop a functional clone of Yousician/Simply Piano that runs locally. The system must capture scores open in MuseScore (via QML plugin), process that data in a Python backend, and display it in an Electron (Canvas) interface where the user's MIDI input is validated in real time.

### **1. System architecture**

The system must be divided into three main components communicating via WebSockets:

1. **Producer (MuseScore plugin):** A plugin written in QML/JavaScript that extracts notes, tempos, and measures from the active score and sends them as JSON.  
2. **Controller (Python backend):** The app's "brain". It must manage a WebSocket server, process MIDI input (USB/Bluetooth), and perform logical validation (compare played note vs expected note).  
3. **Viewer (Electron frontend):** A high-performance interface using Three.js to render the waterfall of notes at 60 FPS.

### **2. Technology stack and libraries**

* **Backend:** Python 3.x.  
  * websockets: For asynchronous communication.  
  * mido & python-rtmidi: For capturing MIDI events.  
  * music21: For processing musical structures and theory (conversion of ticks/offsets to milliseconds).  
* **Frontend:** Electron.js + Three.js.  
* **Plugin:** QML (MuseScore 4.x API).

### **3. Detailed task specifications (execution order)**

#### **Phase 1: Handshake (communication)**

* Create a WebSocket server in Python that listens on port 8765.  
* Create a basic MuseScore plugin (.qml) that, when run, sends a "Hello" message to the server.  
* Configure Electron to connect to the same server and display connection status.

#### **Phase 2: Data extraction (the plugin)**

* The QML plugin must iterate over `curScore.parts`, accessing measures and segments.  
* Extract: Pitch (MIDI number), Duration (ticks), and Offset (position in time).  
* Convert this data to structured JSON and send it via WebSocket as soon as the user hits play or invokes the plugin.

#### **Phase 3: MIDI input engine (Python)**

* Implement a routine using `mido` to list MIDI devices and open the selected port (USB or Bluetooth).  
* The backend must process `note_on` messages and transform them into a format the validator understands.

#### **Phase 4: The validator and Music21**

* Use `music21` to convert score timings (based on rhythmic divisions) into an absolute timeline (milliseconds).  
* **Validation logic:** Create a function that receives the MIDI note and checks whether it matches the score note within a tolerance window (e.g. ±100ms).

#### **Phase 5: Waterfall visualization (Electron)**

* Develop the rendering engine on Canvas. Notes must descend vertically.  
* The backend must send a "trigger" signal to the frontend for each note that should be drawn.  
* Implement visual feedback: Notes turn green if played correctly and red if there is an error.

### **4. Critical requirements and extra notes**

* **Latency:** The absolute priority is low latency. Use asynchronous processing in Python so MIDI reading is not blocked.  
* **Synchronization:** Time "zero" must be defined when the user starts playback in MuseScore or in the app.  
* **Interface:** In Electron, include a MIDI device selector so the user can choose between USB or Bluetooth.  
* **No intermediate files:** Data flow must be purely in memory/WebSockets; avoid saving `.midi` or `.xml` files to disk during execution.
