# Soundscapes

**Ambient Mixing Desktop Application**

Technical Specification Document | Version 1.0

---

## Executive Summary

Soundscapes is a lightweight, cross-platform desktop application for mixing ambient sounds with music playback. It features an innovative A/B crossfade system for seamless ambient loops, sophisticated audio processing per sound (pitch shifting, panning, filtering, reverb), and a unique repeat/pause range system for natural variation. The application includes a full-featured music player with queue management, a soundboard for instant sound effects, and comprehensive preset/scene management.

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Tauri 2.0 | Lightweight cross-platform desktop framework |
| Frontend | React + TypeScript | UI components and state management |
| Backend | Rust | File system operations, settings persistence, hotkeys |
| Audio Engine | Web Audio API | All audio processing and playback |
| State Management | Zustand | Reactive state across components |
| Styling | CSS/Tailwind | Custom styling with provided color palette |
| Platforms | Windows, macOS, Linux | Primary: Windows; Secondary: macOS, Linux |

### Color Palette

```css
:root {
  --bg-primary: #141414;
  --bg-secondary: #313131;
  --accent-purple: #a287f4;
  --accent-cyan: #12e6c8;
  --accent-green: #3cf281;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --border: #2a5a5e;
}
```

---

## Application Architecture

### Directory Structure

```
soundscapes/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── file_scanner.rs      # Scan folders for audio
│   │   ├── settings.rs          # Persistence layer
│   │   └── hotkeys.rs           # Global hotkey registration
│   └── Cargo.toml
├── src/                          # React frontend
│   ├── components/
│   │   ├── MainWindow/          # Primary visualization window
│   │   ├── Sidebar/             # Navigation sidebar
│   │   ├── MusicPlaylist/       # Music player child window
│   │   ├── AmbientSoundscapes/  # Ambient mixer child window
│   │   ├── Soundboard/          # Soundboard child window
│   │   └── AdvancedSettings/    # Settings child window
│   ├── audio/
│   │   └── AudioEngine.ts       # Core Web Audio logic
│   ├── stores/
│   │   ├── audioStore.ts        # Audio state
│   │   ├── playlistStore.ts     # Music queue state
│   │   ├── ambientStore.ts      # Ambient settings state
│   │   └── settingsStore.ts     # App settings
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   └── App.tsx
└── [User Data Folders]           # Configurable locations
```

### User Data Folder Structure

```
[Music Folder]/
├── [Album Name]/
│   ├── metadata.json
│   └── *.mp3, *.wav, *.flac, *.ogg

[Ambient Folder]/
├── [Category Name]/
│   ├── metadata.json
│   ├── [sound]_a.mp3
│   └── [sound]_b.mp3

[Soundboard Folder]/
├── metadata.json
└── *.mp3, *.wav

[Presets Folder]/
└── *.soundscape              # JSON preset files
```

---

## Core Features

### 1. Main Window

The main application window displays the audio visualization and master controls.

#### Visualization: Distorted Orb

- Animated orb that pulses with master audio volume
- Color shifts based on dominant frequency: warm (red/orange) for bass-heavy, cool (blue/cyan) for high frequencies
- Orb is static/inactive when master is muted
- Implementation: Use Web Audio AnalyserNode for FFT data, render with Canvas or WebGL

#### Now Playing Display

- Track title and artist name
- Progress bar with seek functionality
- Play, Pause, Skip buttons
- Visual indication when music is muted (grayed out, icon overlay)
- Show even when music is muted

#### Volume Controls

| Control | Description | Default |
|---------|-------------|---------|
| Master Volume | Controls all audio output | 100% |
| Master Mute | Mutes all audio; orb becomes inactive | Off |
| Music Sub-master | Scales all music playback | 100% |
| Music Mute | Mutes music only | Off |
| Ambient Sub-master | Scales all ambient sounds | 100% |
| Ambient Mute | Mutes ambient only | Off |
| Soundboard Sub-master | Scales soundboard playback | 100% |
| Soundboard Mute | Mutes soundboard only | Off |

#### Sidebar Navigation

Left sidebar with icon buttons (column layout, icons floated to bottom except Power):

- Music Playlist icon - opens Music Playlist child window
- Ambient Soundscapes icon - opens Ambient Soundscapes child window
- Soundboard icon - opens Soundboard child window
- Settings icon - opens Advanced Settings child window
- Power icon (bottom) - closes the application

---

### 2. Music Playlist Window

Child window for managing and playing music.

#### Album Management

- Collapsible album sections (expand/collapse)
- Display album name and track count
- Auto-detected from folder structure

#### Track Features

- Favorite toggle (star icon) per track
- Three action buttons per track:
  - **Add to Queue** - append to end of queue
  - **Play Next** - insert after current song
  - **Play Now** - interrupt current, start immediately

#### Playlist Management

- Create custom playlists from any albums
- Default "Favorites" playlist (auto-populated from favorited tracks)
- Easy playlist switching
- Shuffle toggle (random vs. sequential playback)

#### Queue Display

- Show current queue with drag-to-reorder
- Remove tracks from queue
- Clear queue option

#### Music Crossfade

Music playback includes fade-in and fade-out between tracks (configurable duration in settings).

---

### 3. Ambient Soundscapes Window

Child window for managing ambient sound mixing.

#### Sound Categories

- Collapsible category sections (e.g., Rain, Forest, Urban)
- Select All / Select None buttons per category
- Individual sound checkboxes to enable/disable

#### Per-Sound Controls

- Enable/disable checkbox
- Volume slider (always visible)
- Preview button (mutes all other audio during preview)
- Collapsible advanced settings panel:

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| Pitch | Slider | 0.5x - 2.0x | 1.0x | Playback rate (affects speed) |
| Pan | Slider | -100 to +100 | 0 | Stereo position (L/R) |
| Low-Pass Filter | Slider | 200Hz - 22kHz | 22kHz | Frequency cutoff |
| Reverb Type | Dropdown | Off, Small Room, Large Hall, Cathedral | Off | Convolution reverb |
| Algorithmic Reverb | Slider | 0% - 100% | 0% | Simple reverb (mutually exclusive with convolution) |
| Repeat Range Min | Number | 1 - 10 | 1 | Minimum A/B cycles before pause |
| Repeat Range Max | Number | 1 - 10 | 1 | Maximum A/B cycles before pause |
| Pause Range Min | Number | 0 - 10 | 0 | Minimum pause cycles |
| Pause Range Max | Number | 0 - 10 | 0 | Maximum pause cycles |
| Volume Variation | Slider | 0% - 50% | 0% | Random volume ± per loop |

#### Preset Management

- Save current configuration as preset
- Save prompt: Override existing or create new
- Load preset dropdown/list
- Clear button - disables all sounds in current preset
- Hide/Show unselected sounds toggle
- Export preset (.soundscape file including audio files)
- Import preset

---

### 4. Soundboard Window

Child window for instant sound effect playback.

#### Features

- Grid layout of sound buttons
- Individual volume control per sound (remembered)
- Customizable hotkey assignment per sound
- Visual feedback when playing
- Button colors (configurable via metadata)

#### Playback Behavior

- Sounds play immediately on click/hotkey
- Only one soundboard sound plays at a time (queue subsequent)
- Ducking: Other audio (ambient/music) is lowered when soundboard plays
- Duck amount is configurable in Advanced Settings

---

### 5. Advanced Settings Window

Child window for application configuration.

#### Folder Locations

- Music Albums folder - button to open in file explorer
- Ambient Sound Groups folder - button to open in file explorer
- Soundboard folder - button to open in file explorer
- Soundscape Presets folder - button to open in file explorer
- Buttons to change each folder location

#### Audio Settings

- Output device selector (dropdown of available devices)
- Test sound button (plays provided test audio file)
- Music crossfade duration (slider, 0-10 seconds)
- Soundboard duck amount (slider, 0-100%)

#### Other

- Refresh button - rescan all folders for new audio files
- Reset to defaults button

---

## Audio Engine Specification

### A/B Crossfade System

Each ambient sound consists of two audio files (_a and _b variants) that crossfade seamlessly.

#### Playback Flow

1. Load both A and B audio files
2. Play A file completely
3. When A ends, immediately play B (seamless transition)
4. When B ends, play A again
5. This counts as one "loop" (A→B)

#### Repeat/Pause System

```javascript
function getNextPlaybackState(config) {
  // Randomly select repeat count within range
  const repeatCount = randomInt(config.repeatRangeMin, config.repeatRangeMax);
  
  // Play A→B 'repeatCount' times
  for (let i = 0; i < repeatCount; i++) {
    await playAFile();
    await playBFile();
    applyVolumeVariation(config.volumeVariation);
  }
  
  // Randomly select pause duration within range
  const pauseLoops = randomInt(config.pauseRangeMin, config.pauseRangeMax);
  const loopDuration = aFileDuration + bFileDuration;
  
  // Pause (silence) for pauseLoops × loopDuration
  await wait(pauseLoops * loopDuration);
  
  // Repeat the cycle
}
```

### Audio Node Graph (Per Ambient Sound)

```
AudioSource (A or B)
    ↓
GainNode (volume + volume variation)
    ↓
StereoPannerNode (pan control)
    ↓
BiquadFilterNode (low-pass filter)
    ↓
ConvolverNode (convolution reverb) ─OR─ DelayNode chain (algorithmic reverb)
    ↓
GainNode (ambient sub-master)
    ↓
GainNode (master volume)
    ↓
AnalyserNode (for visualization)
    ↓
AudioContext.destination
```

### Audio Node Graph (Music)

```
AudioSource (HTMLAudioElement or AudioBufferSource)
    ↓
GainNode (fade in/out + volume)
    ↓
GainNode (music sub-master)
    ↓
GainNode (ducking from soundboard)
    ↓
GainNode (master volume)
    ↓
AnalyserNode (for visualization)
    ↓
AudioContext.destination
```

### Pitch Shifting

For v1.0, use `HTMLAudioElement.playbackRate` or `AudioBufferSourceNode.playbackRate`. This changes both pitch and speed together. Architecture should allow for future implementation of true pitch shifting (using libraries like Tone.js or SoundTouchJS) without major refactoring.

---

## Data Models

### Metadata JSON Schemas

#### Ambient Category (metadata.json)

```json
{
  "name": "Rain & Storm",
  "icon": "cloud-rain",
  "sounds": [
    {
      "id": "rain-gentle",
      "name": "Gentle Rain",
      "files": {
        "a": "rain_gentle_a.mp3",
        "b": "rain_gentle_b.mp3"
      },
      "defaults": {
        "volume": 50,
        "pitch": 1.0,
        "pan": 0,
        "lowPassFreq": 22000,
        "reverbType": "off",
        "algorithmicReverb": 0,
        "repeatRangeMin": 1,
        "repeatRangeMax": 1,
        "pauseRangeMin": 0,
        "pauseRangeMax": 0,
        "volumeVariation": 0
      }
    }
  ]
}
```

#### Music Album (metadata.json)

```json
{
  "name": "Lo-Fi Collection",
  "artist": "Various Artists",
  "tracks": [
    {
      "id": "track-001",
      "file": "01_rainy_cafe.mp3",
      "title": "Rainy Café",
      "artist": "Artist Name"
    }
  ]
}
```

#### Soundboard (metadata.json)

```json
{
  "sounds": [
    {
      "id": "airhorn",
      "name": "Air Horn",
      "file": "airhorn.mp3",
      "volume": 80,
      "hotkey": "F1",
      "color": "#ff4444"
    }
  ]
}
```

#### Soundscape Preset (.soundscape)

```json
{
  "name": "Rainy Night",
  "created": "2025-01-20T00:00:00Z",
  "modified": "2025-01-20T00:00:00Z",
  "sounds": [
    {
      "categoryId": "rain-storm",
      "soundId": "rain-gentle",
      "enabled": true,
      "volume": 70,
      "pitch": 0.95,
      "pan": -20,
      "lowPassFreq": 8000,
      "reverbType": "small-room",
      "algorithmicReverb": 0,
      "repeatRangeMin": 1,
      "repeatRangeMax": 1,
      "pauseRangeMin": 0,
      "pauseRangeMax": 0,
      "volumeVariation": 5
    }
  ]
}
```

### TypeScript Interfaces

```typescript
// Audio Types
interface AmbientSound {
  id: string;
  name: string;
  categoryId: string;
  filesA: string;
  filesB: string;
  enabled: boolean;
  volume: number;
  pitch: number;
  pan: number;
  lowPassFreq: number;
  reverbType: 'off' | 'small-room' | 'large-hall' | 'cathedral';
  algorithmicReverb: number;
  repeatRangeMin: number;
  repeatRangeMax: number;
  pauseRangeMin: number;
  pauseRangeMax: number;
  volumeVariation: number;
}

interface MusicTrack {
  id: string;
  file: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  favorite: boolean;
}

interface SoundboardSound {
  id: string;
  name: string;
  file: string;
  volume: number;
  hotkey: string | null;
  color: string;
}

interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  isDefault: boolean;
}

interface SoundscapePreset {
  id: string;
  name: string;
  created: string;
  modified: string;
  sounds: AmbientSoundConfig[];
}

// Settings
interface AppSettings {
  musicFolderPath: string;
  ambientFolderPath: string;
  soundboardFolderPath: string;
  presetsFolderPath: string;
  outputDevice: string;
  musicCrossfadeDuration: number;
  soundboardDuckAmount: number;
  masterVolume: number;
  musicSubMasterVolume: number;
  ambientSubMasterVolume: number;
  soundboardSubMasterVolume: number;
  lastPresetId: string | null;
  lastPlaylistId: string | null;
  shuffleEnabled: boolean;
}
```

---

## Initial Setup Instructions

Follow these steps to prepare the GitHub repository before handing off to development.

### Step 1: Create GitHub Repository

1. Go to github.com and create a new repository named "soundscapes"
2. Initialize with README.md
3. Add .gitignore for Node (this covers most of what we need)
4. Choose MIT License (or your preferred open source license)
5. Clone the repository locally

### Step 2: Create Folder Structure

Create these folders in your repository root:

```
soundscapes/
├── assets/
│   ├── icon.ico                  # App icon (256x256 recommended)
│   ├── icon.png                  # PNG version for other platforms
│   └── impulse-responses/        # Reverb IR files
│       ├── small-room.wav
│       ├── large-hall.wav
│       └── cathedral.wav
│   └── test-sound/
│       ├── test-sound.mp3        # Test sound for settings
├── sample-content/               # Sample content for testing
│   ├── Music/
│   │   └── [Sample Album]/
│   │       ├── metadata.json
│   │       └── *.mp3
│   ├── Ambient/
│   │   └── [Sample Category]/
│   │       ├── metadata.json
│   │       ├── *_a.mp3
│   │       └── *_b.mp3
│   └── Soundboard/
│       ├── metadata.json
│       └── *.mp3
└── docs/
    └── SPECIFICATION.md          # This document
```

### Step 3: Add Sample Audio Files

Add at least the following sample content for testing:

**Music (1 album, 2-3 tracks)**
- Create folder: `sample-content/Music/Sample Album/`
- Add 2-3 royalty-free music tracks (MP3 format)
- Create metadata.json with track info

**Ambient (1 category, 2-3 sounds)**
- Create folder: `sample-content/Ambient/Nature/`
- Add 2-3 ambient sound pairs (sound_a.mp3, sound_b.mp3)
- A and B files should be similar sounds that loop well together
- Create metadata.json with sound definitions

**Soundboard (3-5 sounds)**
- Create folder: `sample-content/Soundboard/`
- Add test-sound.mp3 (short beep or chime for device testing)
- Add 3-5 sound effect files
- Create metadata.json

**Impulse Responses (for convolution reverb)**
- Download free IR files from OpenAir or similar
- Add small-room.wav, large-hall.wav, cathedral.wav

### Step 4: Add App Icon

- Create or obtain an icon for the application
- Save as icon.ico (256x256) for Windows
- Save as icon.png for other platforms
- Place in assets/ folder

### Step 5: Create Sample Metadata Files

Create example metadata.json files in each sample folder following the schemas defined in this specification.

### Step 6: Update .gitignore

Add these entries to .gitignore:

```
# Tauri
src-tauri/target/

# Node
node_modules/
dist/

# User data (when testing)
user-data/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

### Step 7: Push to GitHub

```bash
git add .
git commit -m "Initial setup with sample content and specification"
git push origin main
```

---

## Recommended Development Phases

### Phase 1: Foundation
- Tauri 2.0 project setup with React + TypeScript
- Basic window management (main window + child windows)
- Folder scanning and metadata parsing (Rust backend)
- Settings persistence
- Basic UI shell with color palette

### Phase 2: Core Audio
- AudioEngine class with Web Audio API setup
- Master volume and sub-master routing
- Basic music playback with queue
- A/B crossfade ambient playback (basic)
- Soundboard playback with ducking

### Phase 3: Advanced Ambient
- Repeat/pause range system
- Per-sound audio effects (pitch, pan, filter, reverb)
- Volume variation
- Preset save/load

### Phase 4: Music Player Features
- Full playlist management
- Favorites system
- Queue management (add, play next, play now)
- Shuffle/sequential modes
- Music crossfade

### Phase 5: UI Polish
- Distorted orb visualization
- Now playing display
- Collapsible sections in all windows
- Hotkey support for soundboard
- Preview functionality for ambient sounds

### Phase 6: Export/Import & Polish
- Soundscape export (.soundscape with audio files)
- Soundscape import
- Device selection
- Session persistence (remember last state)
- Cross-platform testing and fixes

---

*End of Specification*
