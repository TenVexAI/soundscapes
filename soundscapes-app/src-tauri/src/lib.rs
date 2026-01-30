use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::mpsc::{channel, Sender};
use std::sync::Arc;
use std::thread;
use std::time::Instant;
use parking_lot::Mutex;
use rand::Rng;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use rodio::cpal::traits::{DeviceTrait, HostTrait};
use walkdir::WalkDir;
use rustfft::{FftPlanner, num_complex::Complex};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MusicTrack {
    pub id: String,
    pub file: String,
    pub title: String,
    pub artist: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MusicAlbum {
    pub name: String,
    pub artist: String,
    pub tracks: Vec<MusicTrack>,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AmbientSoundDefaults {
    pub volume: Option<u32>,
    pub pitch: Option<f32>,
    pub pan: Option<i32>,
    #[serde(rename = "lowPassFreq")]
    pub low_pass_freq: Option<u32>,
    #[serde(rename = "reverbType")]
    pub reverb_type: Option<String>,
    #[serde(rename = "algorithmicReverb")]
    pub algorithmic_reverb: Option<u32>,
    #[serde(rename = "repeatRangeMin")]
    pub repeat_range_min: Option<u32>,
    #[serde(rename = "repeatRangeMax")]
    pub repeat_range_max: Option<u32>,
    #[serde(rename = "pauseRangeMin")]
    pub pause_range_min: Option<u32>,
    #[serde(rename = "pauseRangeMax")]
    pub pause_range_max: Option<u32>,
    #[serde(rename = "volumeVariation")]
    pub volume_variation: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AmbientSoundFiles {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AmbientSoundDef {
    pub id: String,
    pub name: String,
    pub files: AmbientSoundFiles,
    pub defaults: Option<AmbientSoundDefaults>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AmbientCategory {
    pub name: String,
    pub icon: Option<String>,
    pub sounds: Vec<AmbientSoundDef>,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoundboardSound {
    pub id: String,
    pub name: String,
    pub file: String,
    pub volume: Option<u32>,
    pub hotkey: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoundboardData {
    pub sounds: Vec<SoundboardSound>,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub music_folder_path: String,
    pub ambient_folder_path: String,
    pub soundboard_folder_path: String,
    pub presets_folder_path: String,
    pub music_crossfade_duration: f32,
    pub soundboard_duck_amount: f32,
}

#[derive(Debug, Serialize, Deserialize)]
struct MusicMetadata {
    name: String,
    artist: String,
    tracks: Vec<MusicTrack>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AmbientMetadata {
    name: String,
    icon: Option<String>,
    sounds: Vec<AmbientSoundDef>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SoundboardMetadata {
    sounds: Vec<SoundboardSound>,
}

// Ambient sound settings matching the spec
#[derive(Clone)]
struct AmbientSettings {
    volume: f32,           // 0.0 - 1.0
    pitch: f32,            // 0.5 - 2.0 (playback speed)
    pan: f32,              // -1.0 to 1.0 (L/R)
    repeat_min: u32,       // Min A/B cycles before pause
    repeat_max: u32,       // Max A/B cycles before pause
    pause_min: u32,        // Min pause cycles
    pause_max: u32,        // Max pause cycles
    volume_variation: f32, // 0.0 - 0.5 (random ± per loop)
}

impl Default for AmbientSettings {
    fn default() -> Self {
        Self {
            volume: 1.0,
            pitch: 1.0,
            pan: 0.0,
            repeat_min: 1,
            repeat_max: 1,
            pause_min: 0,
            pause_max: 0,
            volume_variation: 0.0,
        }
    }
}

// Audio Commands sent to the audio thread
enum AudioCommand {
    // Music commands
    Play(String),
    Stop,
    Pause,
    Resume,
    SetVolume(f32),
    SetMasterVolume(f32),
    SetMuted(bool),
    SetMasterMuted(bool),
    // Ambient commands
    PlayAmbient {
        id: String,
        file_a: String,
        file_b: String,
        settings: AmbientSettings,
    },
    StopAmbient(String),
    UpdateAmbientSettings { id: String, settings: AmbientSettings },
    SetAmbientMasterVolume(f32),
    SetAmbientMuted(bool),
}

// Shared state for progress tracking (this is Send + Sync)
#[derive(Clone)]
struct AudioProgress {
    current_time: f64,
    duration: f64,
    is_playing: bool,
    is_finished: bool,
}

// Number of FFT frequency bins to send to frontend
const FFT_SIZE: usize = 64;

// Playback state for visualization with FFT data
#[derive(Clone)]
struct PlaybackState {
    music_playing: bool,
    music_volume: f32,
    ambient_count: u32,
    ambient_volume: f32,
    master_volume: f32,
    is_muted: bool,
    // FFT frequency data (0.0-1.0 for each bin)
    frequencies: Vec<f32>,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            music_playing: false,
            music_volume: 0.0,
            ambient_count: 0,
            ambient_volume: 0.0,
            master_volume: 1.0,
            is_muted: false,
            frequencies: vec![0.0; FFT_SIZE],
        }
    }
}

// Lock-free circular buffer for FFT samples - avoids mutex contention that causes static
const FFT_BUFFER_SIZE: usize = 2048;

struct FftSampleBuffer {
    buffer: [std::sync::atomic::AtomicU32; FFT_BUFFER_SIZE],
    write_pos: std::sync::atomic::AtomicUsize,
}

impl FftSampleBuffer {
    fn new() -> Self {
        Self {
            buffer: std::array::from_fn(|_| std::sync::atomic::AtomicU32::new(0)),
            write_pos: std::sync::atomic::AtomicUsize::new(0),
        }
    }
    
    fn push(&self, sample: f32) {
        let pos = self.write_pos.fetch_add(1, std::sync::atomic::Ordering::Relaxed) % FFT_BUFFER_SIZE;
        self.buffer[pos].store(sample.to_bits(), std::sync::atomic::Ordering::Relaxed);
    }
    
    fn get_latest(&self, count: usize) -> Vec<f32> {
        let write_pos = self.write_pos.load(std::sync::atomic::Ordering::Relaxed);
        let mut result = Vec::with_capacity(count);
        for i in 0..count {
            let pos = (write_pos + FFT_BUFFER_SIZE - count + i) % FFT_BUFFER_SIZE;
            let bits = self.buffer[pos].load(std::sync::atomic::Ordering::Relaxed);
            result.push(f32::from_bits(bits));
        }
        result
    }
    
    fn clear(&self) {
        self.write_pos.store(0, std::sync::atomic::Ordering::Relaxed);
        for atom in &self.buffer {
            atom.store(0, std::sync::atomic::Ordering::Relaxed);
        }
    }
}

// Source wrapper that copies samples for FFT analysis (lock-free)
struct AnalyzingSource<S> {
    inner: S,
    sample_buffer: Arc<FftSampleBuffer>,
}

impl<S> AnalyzingSource<S> {
    fn new(inner: S, sample_buffer: Arc<FftSampleBuffer>) -> Self {
        Self { inner, sample_buffer }
    }
}

impl<S> Iterator for AnalyzingSource<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.inner.next()?;
        self.sample_buffer.push(sample);
        Some(sample)
    }
}

impl<S> Source for AnalyzingSource<S>
where
    S: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }

    fn channels(&self) -> u16 {
        self.inner.channels()
    }

    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<std::time::Duration> {
        self.inner.total_duration()
    }
}

struct AudioController {
    command_tx: Sender<AudioCommand>,
    progress: Arc<Mutex<AudioProgress>>,
    playback_state: Arc<Mutex<PlaybackState>>,
    sample_buffer: Arc<FftSampleBuffer>,
}

impl AudioController {
    fn new() -> Self {
        let (command_tx, command_rx) = channel::<AudioCommand>();
        let progress = Arc::new(Mutex::new(AudioProgress {
            current_time: 0.0,
            duration: 0.0,
            is_playing: false,
            is_finished: true,
        }));
        let playback_state = Arc::new(Mutex::new(PlaybackState::default()));
        let sample_buffer = Arc::new(FftSampleBuffer::new());
        
        let progress_clone = progress.clone();
        let playback_state_clone = playback_state.clone();
        let sample_buffer_clone = sample_buffer.clone();
        
        // Spawn audio thread
        thread::spawn(move || {
            let (_stream, stream_handle) = match OutputStream::try_default() {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("Failed to create audio output: {}", e);
                    return;
                }
            };
            
            let mut current_sink: Option<Sink> = None;
            let mut music_volume: f32 = 1.0;
            let mut master_volume: f32 = 1.0;
            let mut is_muted = false;
            let mut is_master_muted = false;
            let mut track_start: Option<Instant> = None;
            let mut track_duration: f64 = 0.0;
            
            // FFT setup
            let mut fft_planner = FftPlanner::<f32>::new();
            let fft = fft_planner.plan_fft_forward(1024);
            let mut fft_buffer: Vec<Complex<f32>> = vec![Complex::new(0.0, 0.0); 1024];
            
            // Ambient sounds state - A/B crossfade system
            struct AmbientState {
                sink: Sink,
                file_a: String,
                file_b: String,
                settings: AmbientSettings,
                is_playing_a: bool,      // true = A, false = B
                loops_remaining: u32,    // A/B cycles before pause
                pause_remaining: f64,    // seconds of pause remaining
                is_paused: bool,         // in pause state
            }
            let mut ambient_states: HashMap<String, AmbientState> = HashMap::new();
            let mut ambient_master_volume: f32 = 1.0;
            let mut is_ambient_muted = false;
            
            // Helper to calculate effective volume with variation
            fn calc_ambient_volume(
                settings: &AmbientSettings,
                ambient_master: f32,
                master: f32,
                is_ambient_muted: bool,
                is_master_muted: bool,
            ) -> f32 {
                if is_ambient_muted || is_master_muted {
                    0.0
                } else {
                    let variation = if settings.volume_variation > 0.0 {
                        let var = (rand::random::<f32>() - 0.5) * 2.0 * settings.volume_variation;
                        (1.0 + var).max(0.0).min(2.0)
                    } else {
                        1.0
                    };
                    settings.volume * ambient_master * master * variation
                }
            }
            
            loop {
                // Update progress
                if let Some(ref sink) = current_sink {
                    let is_empty = sink.empty();
                    let is_paused = sink.is_paused();
                    
                    let mut prog = progress_clone.lock();
                    prog.is_finished = is_empty;
                    prog.is_playing = !is_empty && !is_paused;
                    prog.duration = track_duration;
                    if let Some(start) = track_start {
                        if !is_paused {
                            prog.current_time = start.elapsed().as_secs_f64();
                        }
                    }
                }
                
                // Update playback state for visualization with FFT
                {
                    let music_playing = current_sink.as_ref()
                        .map(|s| !s.empty() && !s.is_paused())
                        .unwrap_or(false);
                    
                    let active_ambient_count = ambient_states.values()
                        .filter(|s| !s.is_paused && !s.sink.empty())
                        .count() as u32;
                    
                    let effective_music_vol = if is_muted || is_master_muted { 0.0 } else { music_volume * master_volume };
                    let effective_ambient_vol = if is_ambient_muted || is_master_muted { 0.0 } else { ambient_master_volume * master_volume };
                    
                    // Perform FFT on sample buffer (lock-free read)
                    let mut frequencies = vec![0.0f32; FFT_SIZE];
                    {
                        let samples = sample_buffer_clone.get_latest(1024);
                        // Copy samples to FFT buffer with Hann window
                        for (i, &sample) in samples.iter().enumerate() {
                            let window = 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / 1023.0).cos());
                            fft_buffer[i] = Complex::new(sample * window, 0.0);
                        }
                        
                        // Run FFT
                        fft.process(&mut fft_buffer);
                        
                        // Convert to magnitudes and bin into FFT_SIZE buckets
                        let bins_per_bucket = 512 / FFT_SIZE; // Only use first half (positive frequencies)
                        
                        for i in 0..FFT_SIZE {
                            let mut sum = 0.0f32;
                            for j in 0..bins_per_bucket {
                                let idx = i * bins_per_bucket + j;
                                if idx < 512 {
                                    sum += fft_buffer[idx].norm();
                                }
                            }
                            // Average the bin values
                            let mag = sum / bins_per_bucket as f32;
                            // Use log scale for better dynamic range
                            let log_mag = (1.0 + mag * 50.0).ln() / 5.0;
                            frequencies[i] = log_mag.clamp(0.0, 1.0);
                        }
                    }
                    
                    let mut state = playback_state_clone.lock();
                    state.music_playing = music_playing;
                    state.music_volume = effective_music_vol;
                    state.ambient_count = active_ambient_count;
                    state.ambient_volume = effective_ambient_vol;
                    state.master_volume = master_volume;
                    state.is_muted = is_master_muted;
                    state.frequencies = frequencies;
                }
                
                // Check for commands (non-blocking with timeout)
                match command_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                    Ok(cmd) => match cmd {
                        AudioCommand::Play(path) => {
                            // Stop current playback
                            if let Some(sink) = current_sink.take() {
                                sink.stop();
                            }
                            
                            // Clear sample buffer for new track
                            sample_buffer_clone.clear();
                            
                            // Load and play new file
                            match File::open(&path) {
                                Ok(file) => {
                                    let reader = BufReader::new(file);
                                    match Decoder::new(reader) {
                                        Ok(source) => {
                                            let duration = source.total_duration()
                                                .map(|d| d.as_secs_f64())
                                                .unwrap_or(0.0);
                                            
                                            // Convert to f32 samples and wrap with AnalyzingSource for FFT
                                            let source_f32 = source.convert_samples::<f32>();
                                            let analyzing_source = AnalyzingSource::new(
                                                source_f32,
                                                sample_buffer_clone.clone()
                                            );
                                            
                                            match Sink::try_new(&stream_handle) {
                                                Ok(sink) => {
                                                    let effective_vol = if is_muted || is_master_muted {
                                                        0.0
                                                    } else {
                                                        music_volume * master_volume
                                                    };
                                                    sink.set_volume(effective_vol);
                                                    sink.append(analyzing_source);
                                                    
                                                    track_start = Some(Instant::now());
                                                    track_duration = duration;
                                                    current_sink = Some(sink);
                                                    
                                                    let mut prog = progress_clone.lock();
                                                    prog.current_time = 0.0;
                                                    prog.duration = duration;
                                                    prog.is_playing = true;
                                                    prog.is_finished = false;
                                                }
                                                Err(e) => eprintln!("Failed to create sink: {}", e),
                                            }
                                        }
                                        Err(e) => eprintln!("Failed to decode audio: {}", e),
                                    }
                                }
                                Err(e) => eprintln!("Failed to open file {}: {}", path, e),
                            }
                        }
                        AudioCommand::Stop => {
                            if let Some(sink) = current_sink.take() {
                                sink.stop();
                            }
                            track_start = None;
                            let mut prog = progress_clone.lock();
                            prog.is_playing = false;
                            prog.is_finished = true;
                        }
                        AudioCommand::Pause => {
                            if let Some(ref sink) = current_sink {
                                sink.pause();
                            }
                        }
                        AudioCommand::Resume => {
                            if let Some(ref sink) = current_sink {
                                sink.play();
                            }
                        }
                        AudioCommand::SetVolume(vol) => {
                            music_volume = vol;
                            if let Some(ref sink) = current_sink {
                                let effective_vol = if is_muted || is_master_muted {
                                    0.0
                                } else {
                                    music_volume * master_volume
                                };
                                sink.set_volume(effective_vol);
                            }
                        }
                        AudioCommand::SetMasterVolume(vol) => {
                            master_volume = vol;
                            if let Some(ref sink) = current_sink {
                                let effective_vol = if is_muted || is_master_muted {
                                    0.0
                                } else {
                                    music_volume * master_volume
                                };
                                sink.set_volume(effective_vol);
                            }
                        }
                        AudioCommand::SetMuted(muted) => {
                            is_muted = muted;
                            if let Some(ref sink) = current_sink {
                                let effective_vol = if is_muted || is_master_muted {
                                    0.0
                                } else {
                                    music_volume * master_volume
                                };
                                sink.set_volume(effective_vol);
                            }
                        }
                        AudioCommand::SetMasterMuted(muted) => {
                            is_master_muted = muted;
                            if let Some(ref sink) = current_sink {
                                let effective_vol = if is_muted || is_master_muted {
                                    0.0
                                } else {
                                    music_volume * master_volume
                                };
                                sink.set_volume(effective_vol);
                            }
                        }
                        // Ambient sound commands with A/B crossfade
                        AudioCommand::PlayAmbient { id, file_a, file_b, settings } => {
                            // Stop existing ambient sound with this ID if any
                            if let Some(old_state) = ambient_states.remove(&id) {
                                old_state.sink.stop();
                            }
                            
                            // Create sink and start with file A
                            match Sink::try_new(&stream_handle) {
                                Ok(sink) => {
                                    // Load and play file A first
                                    if let Ok(file) = File::open(&file_a) {
                                        let reader = BufReader::new(file);
                                        if let Ok(source) = Decoder::new(reader) {
                                            // Apply pitch (speed) adjustment
                                            let source = source.speed(settings.pitch);
                                            
                                            let effective_vol = calc_ambient_volume(
                                                &settings, ambient_master_volume, master_volume,
                                                is_ambient_muted, is_master_muted
                                            );
                                            sink.set_volume(effective_vol);
                                            sink.append(source);
                                            
                                            // Determine initial loop count
                                            let mut rng = rand::thread_rng();
                                            let loops = rng.gen_range(settings.repeat_min..=settings.repeat_max);
                                            
                                            ambient_states.insert(id, AmbientState {
                                                sink,
                                                file_a,
                                                file_b,
                                                settings,
                                                is_playing_a: true,
                                                loops_remaining: loops,
                                                pause_remaining: 0.0,
                                                is_paused: false,
                                            });
                                        }
                                    }
                                }
                                Err(e) => eprintln!("Failed to create ambient sink: {}", e),
                            }
                        }
                        AudioCommand::StopAmbient(id) => {
                            if let Some(state) = ambient_states.remove(&id) {
                                state.sink.stop();
                            }
                        }
                        AudioCommand::UpdateAmbientSettings { id, settings } => {
                            if let Some(state) = ambient_states.get_mut(&id) {
                                let pitch_changed = (state.settings.pitch - settings.pitch).abs() > 0.001;
                                state.settings = settings;
                                
                                // If pitch changed, restart current file with new pitch
                                if pitch_changed {
                                    state.sink.stop();
                                    // Create new sink
                                    if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                                        let file_path = if state.is_playing_a {
                                            &state.file_a
                                        } else {
                                            &state.file_b
                                        };
                                        if let Ok(file) = File::open(file_path) {
                                            let reader = BufReader::new(file);
                                            if let Ok(source) = Decoder::new(reader) {
                                                let source = source.speed(state.settings.pitch);
                                                let effective_vol = calc_ambient_volume(
                                                    &state.settings, ambient_master_volume, master_volume,
                                                    is_ambient_muted, is_master_muted
                                                );
                                                new_sink.set_volume(effective_vol);
                                                new_sink.append(source);
                                                state.sink = new_sink;
                                            }
                                        }
                                    }
                                } else {
                                    // Just update volume
                                    let effective_vol = calc_ambient_volume(
                                        &state.settings, ambient_master_volume, master_volume,
                                        is_ambient_muted, is_master_muted
                                    );
                                    state.sink.set_volume(effective_vol);
                                }
                            }
                        }
                        AudioCommand::SetAmbientMasterVolume(vol) => {
                            ambient_master_volume = vol;
                            for state in ambient_states.values() {
                                let effective_vol = calc_ambient_volume(
                                    &state.settings, ambient_master_volume, master_volume,
                                    is_ambient_muted, is_master_muted
                                );
                                state.sink.set_volume(effective_vol);
                            }
                        }
                        AudioCommand::SetAmbientMuted(muted) => {
                            is_ambient_muted = muted;
                            for state in ambient_states.values() {
                                let effective_vol = calc_ambient_volume(
                                    &state.settings, ambient_master_volume, master_volume,
                                    is_ambient_muted, is_master_muted
                                );
                                state.sink.set_volume(effective_vol);
                            }
                        }
                    },
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        // A/B crossfade state machine - check each ambient sound
                        let mut rng = rand::thread_rng();
                        for state in ambient_states.values_mut() {
                            // Check if current file finished playing
                            if state.sink.empty() {
                                if state.is_paused {
                                    // In pause state, decrement pause time
                                    state.pause_remaining -= 0.05; // 50ms per loop iteration
                                    if state.pause_remaining <= 0.0 {
                                        state.is_paused = false;
                                        // Start new cycle
                                        state.loops_remaining = rng.gen_range(
                                            state.settings.repeat_min..=state.settings.repeat_max
                                        );
                                        state.is_playing_a = true;
                                        // Play A
                                        if let Ok(file) = File::open(&state.file_a) {
                                            let reader = BufReader::new(file);
                                            if let Ok(source) = Decoder::new(reader) {
                                                let source = source.speed(state.settings.pitch);
                                                let effective_vol = calc_ambient_volume(
                                                    &state.settings, ambient_master_volume, master_volume,
                                                    is_ambient_muted, is_master_muted
                                                );
                                                state.sink.set_volume(effective_vol);
                                                state.sink.append(source);
                                            }
                                        }
                                    }
                                } else if state.is_playing_a {
                                    // A finished, play B
                                    state.is_playing_a = false;
                                    if let Ok(file) = File::open(&state.file_b) {
                                        let reader = BufReader::new(file);
                                        if let Ok(source) = Decoder::new(reader) {
                                            let source = source.speed(state.settings.pitch);
                                            let effective_vol = calc_ambient_volume(
                                                &state.settings, ambient_master_volume, master_volume,
                                                is_ambient_muted, is_master_muted
                                            );
                                            state.sink.set_volume(effective_vol);
                                            state.sink.append(source);
                                        }
                                    }
                                } else {
                                    // B finished, one A/B loop complete
                                    state.loops_remaining = state.loops_remaining.saturating_sub(1);
                                    
                                    if state.loops_remaining == 0 {
                                        // Check if we need to pause
                                        let pause_loops = rng.gen_range(
                                            state.settings.pause_min..=state.settings.pause_max
                                        );
                                        if pause_loops > 0 {
                                            // Calculate pause duration (estimate based on file lengths)
                                            state.is_paused = true;
                                            state.pause_remaining = pause_loops as f64 * 5.0; // ~5s per loop estimate
                                        } else {
                                            // No pause, start new cycle
                                            state.loops_remaining = rng.gen_range(
                                                state.settings.repeat_min..=state.settings.repeat_max
                                            );
                                            state.is_playing_a = true;
                                            if let Ok(file) = File::open(&state.file_a) {
                                                let reader = BufReader::new(file);
                                                if let Ok(source) = Decoder::new(reader) {
                                                    let source = source.speed(state.settings.pitch);
                                                    let effective_vol = calc_ambient_volume(
                                                        &state.settings, ambient_master_volume, master_volume,
                                                        is_ambient_muted, is_master_muted
                                                    );
                                                    state.sink.set_volume(effective_vol);
                                                    state.sink.append(source);
                                                }
                                            }
                                        }
                                    } else {
                                        // More loops to go, play A again
                                        state.is_playing_a = true;
                                        if let Ok(file) = File::open(&state.file_a) {
                                            let reader = BufReader::new(file);
                                            if let Ok(source) = Decoder::new(reader) {
                                                let source = source.speed(state.settings.pitch);
                                                let effective_vol = calc_ambient_volume(
                                                    &state.settings, ambient_master_volume, master_volume,
                                                    is_ambient_muted, is_master_muted
                                                );
                                                state.sink.set_volume(effective_vol);
                                                state.sink.append(source);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        // Channel closed, exit thread
                        break;
                    }
                }
            }
        });
        
        Self { command_tx, progress, playback_state, sample_buffer }
    }
    
    fn send(&self, cmd: AudioCommand) {
        let _ = self.command_tx.send(cmd);
    }
    
    fn get_progress(&self) -> AudioProgress {
        self.progress.lock().clone()
    }
    
    fn get_playback_state(&self) -> PlaybackState {
        self.playback_state.lock().clone()
    }
}

fn get_default_settings() -> AppSettings {
    let exe_path = std::env::current_exe().ok();
    let base_path = exe_path
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .map(|p| p.join("sample-content"))
        .unwrap_or_else(|| {
            dirs::document_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("Soundscapes")
        });
    
    AppSettings {
        music_folder_path: base_path.join("Music").to_string_lossy().to_string(),
        ambient_folder_path: base_path.join("Ambient").to_string_lossy().to_string(),
        soundboard_folder_path: base_path.join("Soundboard").to_string_lossy().to_string(),
        presets_folder_path: base_path.join("Presets").to_string_lossy().to_string(),
        music_crossfade_duration: 3.0,
        soundboard_duck_amount: 0.3,
    }
}

fn get_settings_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Soundscapes")
        .join("settings.json")
}

#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    let settings_path = get_settings_path();
    
    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse settings: {}", e))
    } else {
        Ok(get_default_settings())
    }
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let settings_path = get_settings_path();
    
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

#[tauri::command]
fn scan_music_folder(folder_path: String) -> Result<Vec<MusicAlbum>, String> {
    let path = PathBuf::from(&folder_path);
    let mut albums = Vec::new();
    
    if !path.exists() {
        return Ok(albums);
    }
    
    for entry in WalkDir::new(&path).min_depth(1).max_depth(1) {
        let entry = entry.map_err(|e| format!("Failed to read directory: {}", e))?;
        
        if entry.file_type().is_dir() {
            let metadata_path = entry.path().join("metadata.json");
            
            if metadata_path.exists() {
                let content = fs::read_to_string(&metadata_path)
                    .map_err(|e| format!("Failed to read metadata: {}", e))?;
                
                let metadata: MusicMetadata = serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse metadata: {}", e))?;
                
                albums.push(MusicAlbum {
                    name: metadata.name,
                    artist: metadata.artist,
                    tracks: metadata.tracks,
                    path: entry.path().to_string_lossy().to_string(),
                });
            }
        }
    }
    
    Ok(albums)
}

#[tauri::command]
fn scan_ambient_folder(folder_path: String) -> Result<Vec<AmbientCategory>, String> {
    let path = PathBuf::from(&folder_path);
    let mut categories = Vec::new();
    
    if !path.exists() {
        return Ok(categories);
    }
    
    for entry in WalkDir::new(&path).min_depth(1).max_depth(1) {
        let entry = entry.map_err(|e| format!("Failed to read directory: {}", e))?;
        
        if entry.file_type().is_dir() {
            let metadata_path = entry.path().join("metadata.json");
            
            if metadata_path.exists() {
                let content = fs::read_to_string(&metadata_path)
                    .map_err(|e| format!("Failed to read metadata: {}", e))?;
                
                let metadata: AmbientMetadata = serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse metadata: {}", e))?;
                
                categories.push(AmbientCategory {
                    name: metadata.name,
                    icon: metadata.icon,
                    sounds: metadata.sounds,
                    path: entry.path().to_string_lossy().to_string(),
                });
            }
        }
    }
    
    Ok(categories)
}

#[tauri::command]
fn scan_soundboard_folder(folder_path: String) -> Result<SoundboardData, String> {
    let path = PathBuf::from(&folder_path);
    
    if !path.exists() {
        return Ok(SoundboardData {
            sounds: Vec::new(),
            path: folder_path,
        });
    }
    
    let metadata_path = path.join("metadata.json");
    
    if metadata_path.exists() {
        let content = fs::read_to_string(&metadata_path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        
        let metadata: SoundboardMetadata = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse metadata: {}", e))?;
        
        Ok(SoundboardData {
            sounds: metadata.sounds,
            path: folder_path,
        })
    } else {
        Ok(SoundboardData {
            sounds: Vec::new(),
            path: folder_path,
        })
    }
}

// Audio Commands - using thread-safe AudioController
#[tauri::command]
fn init_audio(state: tauri::State<Arc<AudioController>>) -> Result<(), String> {
    // AudioController is already initialized in run()
    let _ = state.inner();
    Ok(())
}

#[tauri::command]
fn play_music(state: tauri::State<Arc<AudioController>>, file_path: String) -> Result<(), String> {
    state.send(AudioCommand::Play(file_path));
    Ok(())
}

#[tauri::command]
fn stop_music(state: tauri::State<Arc<AudioController>>) -> Result<(), String> {
    state.send(AudioCommand::Stop);
    Ok(())
}

#[tauri::command]
fn pause_music(state: tauri::State<Arc<AudioController>>) -> Result<(), String> {
    state.send(AudioCommand::Pause);
    Ok(())
}

#[tauri::command]
fn resume_music(state: tauri::State<Arc<AudioController>>) -> Result<(), String> {
    state.send(AudioCommand::Resume);
    Ok(())
}

#[tauri::command]
fn set_music_volume(state: tauri::State<Arc<AudioController>>, volume: f32) -> Result<(), String> {
    state.send(AudioCommand::SetVolume(volume));
    Ok(())
}

#[tauri::command]
fn set_master_volume(state: tauri::State<Arc<AudioController>>, volume: f32) -> Result<(), String> {
    state.send(AudioCommand::SetMasterVolume(volume));
    Ok(())
}

#[tauri::command]
fn set_music_muted(state: tauri::State<Arc<AudioController>>, muted: bool) -> Result<(), String> {
    state.send(AudioCommand::SetMuted(muted));
    Ok(())
}

#[tauri::command]
fn set_master_muted(state: tauri::State<Arc<AudioController>>, muted: bool) -> Result<(), String> {
    state.send(AudioCommand::SetMasterMuted(muted));
    Ok(())
}

#[derive(Debug, Serialize)]
struct MusicProgressResponse {
    current_time: f64,
    duration: f64,
    is_playing: bool,
    is_finished: bool,
}

#[tauri::command]
fn get_music_progress(state: tauri::State<Arc<AudioController>>) -> Result<MusicProgressResponse, String> {
    let progress = state.get_progress();
    Ok(MusicProgressResponse {
        current_time: progress.current_time,
        duration: progress.duration,
        is_playing: progress.is_playing,
        is_finished: progress.is_finished,
    })
}

#[derive(Debug, Serialize)]
struct PlaybackStateResponse {
    music_playing: bool,
    music_volume: f32,
    ambient_count: u32,
    ambient_volume: f32,
    master_volume: f32,
    is_muted: bool,
    frequencies: Vec<f32>,
}

#[tauri::command]
fn get_playback_state(state: tauri::State<Arc<AudioController>>) -> Result<PlaybackStateResponse, String> {
    let ps = state.get_playback_state();
    Ok(PlaybackStateResponse {
        music_playing: ps.music_playing,
        music_volume: ps.music_volume,
        ambient_count: ps.ambient_count,
        ambient_volume: ps.ambient_volume,
        master_volume: ps.master_volume,
        is_muted: ps.is_muted,
        frequencies: ps.frequencies,
    })
}

// Ambient sound commands
#[tauri::command]
fn play_ambient(
    state: tauri::State<Arc<AudioController>>,
    id: String,
    file_a: String,
    file_b: String,
    volume: f32,
    pitch: Option<f32>,
    pan: Option<f32>,
    repeat_min: Option<u32>,
    repeat_max: Option<u32>,
    pause_min: Option<u32>,
    pause_max: Option<u32>,
    volume_variation: Option<f32>,
) -> Result<(), String> {
    let settings = AmbientSettings {
        volume,
        pitch: pitch.unwrap_or(1.0),
        pan: pan.unwrap_or(0.0),
        repeat_min: repeat_min.unwrap_or(1),
        repeat_max: repeat_max.unwrap_or(1),
        pause_min: pause_min.unwrap_or(0),
        pause_max: pause_max.unwrap_or(0),
        volume_variation: volume_variation.unwrap_or(0.0),
    };
    state.send(AudioCommand::PlayAmbient { id, file_a, file_b, settings });
    Ok(())
}

#[tauri::command]
fn stop_ambient(state: tauri::State<Arc<AudioController>>, id: String) -> Result<(), String> {
    state.send(AudioCommand::StopAmbient(id));
    Ok(())
}

#[tauri::command]
fn update_ambient_settings(
    state: tauri::State<Arc<AudioController>>,
    id: String,
    volume: f32,
    pitch: Option<f32>,
    pan: Option<f32>,
    repeat_min: Option<u32>,
    repeat_max: Option<u32>,
    pause_min: Option<u32>,
    pause_max: Option<u32>,
    volume_variation: Option<f32>,
) -> Result<(), String> {
    let settings = AmbientSettings {
        volume,
        pitch: pitch.unwrap_or(1.0),
        pan: pan.unwrap_or(0.0),
        repeat_min: repeat_min.unwrap_or(1),
        repeat_max: repeat_max.unwrap_or(1),
        pause_min: pause_min.unwrap_or(0),
        pause_max: pause_max.unwrap_or(0),
        volume_variation: volume_variation.unwrap_or(0.0),
    };
    state.send(AudioCommand::UpdateAmbientSettings { id, settings });
    Ok(())
}

#[tauri::command]
fn set_ambient_master_volume(state: tauri::State<Arc<AudioController>>, volume: f32) -> Result<(), String> {
    state.send(AudioCommand::SetAmbientMasterVolume(volume));
    Ok(())
}

#[tauri::command]
fn set_ambient_muted(state: tauri::State<Arc<AudioController>>, muted: bool) -> Result<(), String> {
    state.send(AudioCommand::SetAmbientMuted(muted));
    Ok(())
}

#[derive(Debug, Serialize, Clone)]
struct AudioDevice {
    id: String,
    name: String,
    is_default: bool,
}

#[tauri::command]
fn get_output_devices() -> Result<Vec<AudioDevice>, String> {
    let host = rodio::cpal::default_host();
    let default_device = host.default_output_device();
    let default_name = default_device.as_ref().and_then(|d| d.name().ok());
    
    let devices: Vec<AudioDevice> = host.output_devices()
        .map_err(|e| format!("Failed to enumerate devices: {}", e))?
        .filter_map(|device| {
            let name = device.name().ok()?;
            let is_default = default_name.as_ref().map(|dn| dn == &name).unwrap_or(false);
            Some(AudioDevice {
                id: name.clone(),
                name,
                is_default,
            })
        })
        .collect();
    
    Ok(devices)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_controller = Arc::new(AudioController::new());
    
    tauri::Builder::default()
        .manage(audio_controller)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            scan_music_folder,
            scan_ambient_folder,
            scan_soundboard_folder,
            init_audio,
            play_music,
            stop_music,
            pause_music,
            resume_music,
            set_music_volume,
            set_master_volume,
            set_music_muted,
            set_master_muted,
            get_music_progress,
            get_playback_state,
            play_ambient,
            stop_ambient,
            update_ambient_settings,
            set_ambient_master_volume,
            set_ambient_muted,
            get_output_devices
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
