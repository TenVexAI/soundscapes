use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::{BufReader, Cursor, Read};
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

// Current track info for cross-window communication
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CurrentTrackInfo {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub file_path: String,
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

// Soundscape preset types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PresetSound {
    #[serde(rename = "categoryId")]
    pub category_id: String,
    #[serde(rename = "categoryPath")]
    pub category_path: String,
    #[serde(rename = "soundId")]
    pub sound_id: String,
    pub name: String,
    #[serde(rename = "filesA")]
    pub files_a: String,
    #[serde(rename = "filesB")]
    pub files_b: String,
    pub enabled: bool,
    pub volume: u32,
    pub pitch: f32,
    pub pan: i32,
    #[serde(rename = "lowPassFreq")]
    pub low_pass_freq: u32,
    #[serde(rename = "algorithmicReverb")]
    pub algorithmic_reverb: u32,
    #[serde(rename = "repeatRangeMin")]
    pub repeat_range_min: u32,
    #[serde(rename = "repeatRangeMax")]
    pub repeat_range_max: u32,
    #[serde(rename = "pauseRangeMin")]
    pub pause_range_min: u32,
    #[serde(rename = "pauseRangeMax")]
    pub pause_range_max: u32,
    #[serde(rename = "volumeVariation")]
    pub volume_variation: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoundscapePreset {
    pub id: String,
    pub name: String,
    pub created: String,
    pub modified: String,
    pub sounds: Vec<PresetSound>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PresetInfo {
    pub id: String,
    pub name: String,
    pub created: String,
    pub modified: String,
    #[serde(rename = "soundCount")]
    pub sound_count: usize,
}

// Music Playlist types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistTrack {
    pub id: String,
    pub file: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    #[serde(rename = "albumPath")]
    pub album_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MusicPlaylist {
    pub id: String,
    pub name: String,
    #[serde(rename = "isAuto")]
    pub is_auto: bool,  // true for "All Music" and "Favorites"
    pub tracks: Vec<PlaylistTrack>,
}

// Playlist playback state (shared across windows)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PlaylistState {
    #[serde(rename = "currentPlaylistId")]
    pub current_playlist_id: Option<String>,
    #[serde(rename = "currentIndex")]
    pub current_index: i32,
    #[serde(rename = "isShuffled")]
    pub is_shuffled: bool,
    #[serde(rename = "isLooping")]
    pub is_looping: bool,
    pub favorites: Vec<String>,  // Track IDs that are favorited
    #[serde(rename = "interruptedIndex")]
    pub interrupted_index: Option<i32>,  // For resuming after Play Now
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub music_folder_path: String,
    pub ambient_folder_path: String,
    pub soundboard_folder_path: String,
    pub presets_folder_path: String,
    pub music_crossfade_duration: f32,
    pub soundboard_duck_amount: f32,
    #[serde(default = "default_visualization")]
    pub visualization_type: String,
}

fn default_visualization() -> String {
    "orb".to_string()
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
#[derive(Clone, Serialize)]
struct AmbientSettings {
    volume: f32,           // 0.0 - 1.0
    pitch: f32,            // 0.5 - 2.0 (playback speed)
    pan: f32,              // -1.0 to 1.0 (L/R)
    low_pass_freq: f32,    // 20 - 22000 Hz (cutoff frequency)
    reverb_type: String,   // "off", "small-room", "large-hall", "cathedral"
    algorithmic_reverb: f32, // 0.0 - 1.0 (only used when reverb_type is "off")
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
            low_pass_freq: 22000.0, // Effectively off (above human hearing)
            reverb_type: "off".to_string(),
            algorithmic_reverb: 0.0,
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
    Play { file_path: String, track_info: CurrentTrackInfo },
    Stop,
    Pause,
    Resume,
    SetVolume(f32),
    SetMasterVolume(f32),
    SetMuted(bool),
    SetMasterMuted(bool),
    SetCrossfadeDuration(f32),
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
    PreloadAmbient(Vec<String>), // Preload audio files into memory cache
}

// Shared state for tracking active ambient sounds (queryable from outside audio thread)
#[derive(Clone, Serialize)]
struct ActiveAmbientInfo {
    id: String,
    file_a: String,
    file_b: String,
    settings: AmbientSettings,
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
    // Ambient amplitude data (0.0-1.0 for each bin) - derived from RMS tracking
    ambient_frequencies: Vec<f32>,
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
            ambient_frequencies: vec![0.0; FFT_SIZE],
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

// Lock-free buffer for ambient audio samples (for amplitude tracking)
const AMBIENT_BUFFER_SIZE: usize = 2048;

struct AmbientSampleBuffer {
    buffer: [std::sync::atomic::AtomicU32; AMBIENT_BUFFER_SIZE],
    write_pos: std::sync::atomic::AtomicUsize,
}

impl AmbientSampleBuffer {
    fn new() -> Self {
        Self {
            buffer: std::array::from_fn(|_| std::sync::atomic::AtomicU32::new(0)),
            write_pos: std::sync::atomic::AtomicUsize::new(0),
        }
    }
    
    fn push(&self, sample: f32) {
        let pos = self.write_pos.fetch_add(1, std::sync::atomic::Ordering::Relaxed) % AMBIENT_BUFFER_SIZE;
        self.buffer[pos].store(sample.to_bits(), std::sync::atomic::Ordering::Relaxed);
    }
    
    fn get_latest(&self, count: usize) -> Vec<f32> {
        let write_pos = self.write_pos.load(std::sync::atomic::Ordering::Relaxed);
        let mut result = Vec::with_capacity(count);
        for i in 0..count {
            let pos = (write_pos + AMBIENT_BUFFER_SIZE - count + i) % AMBIENT_BUFFER_SIZE;
            let bits = self.buffer[pos].load(std::sync::atomic::Ordering::Relaxed);
            result.push(f32::from_bits(bits));
        }
        result
    }
}

// Source wrapper that copies samples for ambient amplitude analysis (lock-free)
struct AmbientAnalyzingSource<S> {
    inner: S,
    sample_buffer: Arc<AmbientSampleBuffer>,
}

impl<S> AmbientAnalyzingSource<S> {
    fn new(inner: S, sample_buffer: Arc<AmbientSampleBuffer>) -> Self {
        Self { inner, sample_buffer }
    }
}

impl<S> Iterator for AmbientAnalyzingSource<S>
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

impl<S> Source for AmbientAnalyzingSource<S>
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

// Source wrapper for stereo panning (L/R balance)
// pan: -1.0 = full left, 0.0 = center, 1.0 = full right
struct PannedSource<S> {
    inner: S,
    pan: f32,
    channels: u16,
    current_channel: u16,
}

impl<S> PannedSource<S>
where
    S: Source<Item = f32>,
{
    fn new(inner: S, pan: f32) -> Self {
        let channels = inner.channels();
        Self {
            inner,
            pan: pan.clamp(-1.0, 1.0),
            channels,
            current_channel: 0,
        }
    }
}

impl<S> Iterator for PannedSource<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.inner.next()?;
        
        // Only apply panning to stereo sources
        if self.channels == 2 {
            let channel = self.current_channel;
            self.current_channel = (self.current_channel + 1) % self.channels;
            
            // Calculate gain for this channel
            // Left channel (0): full at pan=-1, half at pan=1
            // Right channel (1): half at pan=-1, full at pan=1
            let gain = if channel == 0 {
                // Left channel: 1.0 when pan <= 0, decreases to 0 as pan -> 1
                if self.pan <= 0.0 { 1.0 } else { 1.0 - self.pan }
            } else {
                // Right channel: 1.0 when pan >= 0, decreases to 0 as pan -> -1
                if self.pan >= 0.0 { 1.0 } else { 1.0 + self.pan }
            };
            
            Some(sample * gain)
        } else {
            Some(sample)
        }
    }
}

impl<S> Source for PannedSource<S>
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

// Source wrapper for low-pass filter (simple one-pole IIR filter)
// cutoff_freq: 20 - 22000 Hz
struct LowPassSource<S> {
    inner: S,
    alpha: f32,
    prev_samples: Vec<f32>, // One per channel
    channels: u16,
    current_channel: u16,
}

impl<S> LowPassSource<S>
where
    S: Source<Item = f32>,
{
    fn new(inner: S, cutoff_freq: f32, sample_rate: u32) -> Self {
        let channels = inner.channels();
        // Calculate filter coefficient using RC time constant approximation
        // alpha = dt / (RC + dt) where RC = 1 / (2 * pi * cutoff)
        let dt = 1.0 / sample_rate as f32;
        let rc = 1.0 / (2.0 * std::f32::consts::PI * cutoff_freq.clamp(20.0, 22000.0));
        let alpha = dt / (rc + dt);
        
        Self {
            inner,
            alpha,
            prev_samples: vec![0.0; channels as usize],
            channels,
            current_channel: 0,
        }
    }
}

impl<S> Iterator for LowPassSource<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.inner.next()?;
        let ch = self.current_channel as usize;
        self.current_channel = (self.current_channel + 1) % self.channels;
        
        // One-pole low-pass: y[n] = alpha * x[n] + (1 - alpha) * y[n-1]
        let filtered = self.alpha * sample + (1.0 - self.alpha) * self.prev_samples[ch];
        self.prev_samples[ch] = filtered;
        
        Some(filtered)
    }
}

impl<S> Source for LowPassSource<S>
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

// Source wrapper for algorithmic reverb (Schroeder-style with comb filters)
// mix: 0.0 = dry only, 1.0 = full wet
struct ReverbSource<S> {
    inner: S,
    mix: f32,
    channels: u16,
    current_channel: u16,
    // Delay lines for each channel (4 comb filters per channel)
    comb_buffers: Vec<Vec<Vec<f32>>>, // [channel][comb_index][samples]
    comb_positions: Vec<Vec<usize>>,   // [channel][comb_index]
    // Allpass filters
    allpass_buffers: Vec<Vec<Vec<f32>>>, // [channel][allpass_index][samples]
    allpass_positions: Vec<Vec<usize>>,
}

impl<S> ReverbSource<S>
where
    S: Source<Item = f32>,
{
    fn new(inner: S, mix: f32, sample_rate: u32) -> Self {
        let channels = inner.channels() as usize;
        let mix = mix.clamp(0.0, 1.0);
        
        // Comb filter delay times in samples (long delays for very spacious/echo-y reverb)
        let comb_delays: [usize; 4] = [
            (0.0797 * sample_rate as f32) as usize, // ~80ms
            (0.0903 * sample_rate as f32) as usize, // ~90ms
            (0.1100 * sample_rate as f32) as usize, // ~110ms
            (0.1277 * sample_rate as f32) as usize, // ~128ms
        ];
        
        // Allpass filter delay times (longer for more diffusion)
        let allpass_delays: [usize; 2] = [
            (0.0220 * sample_rate as f32) as usize, // ~22ms
            (0.0074 * sample_rate as f32) as usize, // ~7.4ms
        ];
        
        let mut comb_buffers = Vec::with_capacity(channels);
        let mut comb_positions = Vec::with_capacity(channels);
        let mut allpass_buffers = Vec::with_capacity(channels);
        let mut allpass_positions = Vec::with_capacity(channels);
        
        for _ in 0..channels {
            let mut ch_comb_buffers = Vec::with_capacity(4);
            let mut ch_comb_positions = Vec::with_capacity(4);
            for &delay in &comb_delays {
                ch_comb_buffers.push(vec![0.0; delay.max(1)]);
                ch_comb_positions.push(0);
            }
            comb_buffers.push(ch_comb_buffers);
            comb_positions.push(ch_comb_positions);
            
            let mut ch_allpass_buffers = Vec::with_capacity(2);
            let mut ch_allpass_positions = Vec::with_capacity(2);
            for &delay in &allpass_delays {
                ch_allpass_buffers.push(vec![0.0; delay.max(1)]);
                ch_allpass_positions.push(0);
            }
            allpass_buffers.push(ch_allpass_buffers);
            allpass_positions.push(ch_allpass_positions);
        }
        
        Self {
            inner,
            mix,
            channels: channels as u16,
            current_channel: 0,
            comb_buffers,
            comb_positions,
            allpass_buffers,
            allpass_positions,
        }
    }
}

impl<S> Iterator for ReverbSource<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.inner.next()?;
        
        // Skip processing if mix is 0
        if self.mix < 0.001 {
            self.current_channel = (self.current_channel + 1) % self.channels;
            return Some(sample);
        }
        
        let ch = self.current_channel as usize;
        self.current_channel = (self.current_channel + 1) % self.channels;
        
        // Comb filter bank (parallel)
        let feedback = 0.95; // Very high feedback for long echo-y decay
        let mut comb_sum = 0.0;
        
        for i in 0..4 {
            let buf = &mut self.comb_buffers[ch][i];
            let pos = self.comb_positions[ch][i];
            let delayed = buf[pos];
            let new_val = sample + delayed * feedback;
            buf[pos] = new_val;
            self.comb_positions[ch][i] = (pos + 1) % buf.len();
            comb_sum += delayed;
        }
        comb_sum *= 0.25; // Average the 4 comb outputs
        
        // Allpass filters (series)
        let allpass_coeff = 0.7; // Higher coefficient for more diffusion
        let mut allpass_out = comb_sum;
        
        for i in 0..2 {
            let buf = &mut self.allpass_buffers[ch][i];
            let pos = self.allpass_positions[ch][i];
            let delayed = buf[pos];
            let new_val = allpass_out + delayed * allpass_coeff;
            allpass_out = delayed - allpass_coeff * new_val;
            buf[pos] = new_val;
            self.allpass_positions[ch][i] = (pos + 1) % buf.len();
        }
        
        // Mix dry and wet - aggressive wet signal boost
        let wet_gain = 2.5;
        Some(sample * (1.0 - self.mix) + allpass_out * self.mix * wet_gain)
    }
}

impl<S> Source for ReverbSource<S>
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
    ambient_sample_buffer: Arc<AmbientSampleBuffer>,
    active_ambients: Arc<Mutex<HashMap<String, ActiveAmbientInfo>>>,
    current_track: Arc<Mutex<Option<CurrentTrackInfo>>>,
    playlist_state: Arc<Mutex<PlaylistState>>,
    playlists: Arc<Mutex<HashMap<String, MusicPlaylist>>>,
    all_tracks: Arc<Mutex<Vec<PlaylistTrack>>>,
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
        let ambient_sample_buffer = Arc::new(AmbientSampleBuffer::new());
        let active_ambients = Arc::new(Mutex::new(HashMap::new()));
        let current_track = Arc::new(Mutex::new(None::<CurrentTrackInfo>));
        let playlist_state = Arc::new(Mutex::new(PlaylistState::default()));
        let playlists = Arc::new(Mutex::new(HashMap::new()));
        let all_tracks = Arc::new(Mutex::new(Vec::new()));
        
        let progress_clone = progress.clone();
        let playback_state_clone = playback_state.clone();
        let sample_buffer_clone = sample_buffer.clone();
        let ambient_sample_buffer_clone = ambient_sample_buffer.clone();
        let active_ambients_clone = active_ambients.clone();
        let current_track_clone = current_track.clone();
        
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
            let mut crossfade_duration: f32 = 3.0;  // Default 3 seconds
            // Fade states: fade_out for end of current track, fade_in for start of new track
            let mut fade_out_active: bool = false;  // Currently fading out
            let mut fade_in_progress: Option<(Instant, f32)> = None;  // (start_time, duration) for fade-in
            
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
            
            // Audio file cache - stores file bytes in memory to avoid disk I/O during playback
            let mut audio_cache: HashMap<String, Vec<u8>> = HashMap::new();
            
            // Track sounds that are fading out before stop (id -> fade progress 0.0-1.0)
            let mut fading_out: HashMap<String, f32> = HashMap::new();
            const FADE_STEPS: f32 = 4.0; // ~200ms fade (4 steps × 50ms loop)
            
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
                let target_vol = if is_muted || is_master_muted {
                    0.0
                } else {
                    music_volume * master_volume
                };
                
                // Handle fade-in for new tracks
                if let Some((fade_start, fade_duration)) = fade_in_progress {
                    let elapsed = fade_start.elapsed().as_secs_f32();
                    let progress = (elapsed / fade_duration).clamp(0.0, 1.0);
                    
                    if let Some(ref sink) = current_sink {
                        sink.set_volume(target_vol * progress);
                    }
                    
                    // Fade-in complete
                    if progress >= 1.0 {
                        fade_in_progress = None;
                        if let Some(ref sink) = current_sink {
                            sink.set_volume(target_vol);
                        }
                    }
                }
                
                // Handle automatic fade-out near end of track
                if crossfade_duration > 0.0 && !fade_out_active {
                    if let (Some(start), Some(ref sink)) = (track_start, &current_sink) {
                        if !sink.is_paused() && !sink.empty() {
                            let current_time = start.elapsed().as_secs_f64();
                            let time_remaining = track_duration - current_time;
                            
                            // Start fade-out when we're within crossfade_duration of the end
                            if time_remaining > 0.0 && time_remaining <= crossfade_duration as f64 {
                                fade_out_active = true;
                            }
                        }
                    }
                }
                
                // Apply fade-out volume
                if fade_out_active {
                    if let (Some(start), Some(ref sink)) = (track_start, &current_sink) {
                        let current_time = start.elapsed().as_secs_f64();
                        let time_remaining = (track_duration - current_time).max(0.0);
                        let fade_progress = 1.0 - (time_remaining / crossfade_duration as f64).clamp(0.0, 1.0);
                        
                        // Only apply fade-out if we're not also fading in (which takes precedence)
                        if fade_in_progress.is_none() {
                            sink.set_volume(target_vol * (1.0 - fade_progress as f32));
                        }
                    }
                }
                
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
                    
                    // Compute ambient frequencies from ambient sample buffer (same FFT approach)
                    let mut ambient_frequencies = vec![0.0f32; FFT_SIZE];
                    if active_ambient_count > 0 {
                        let ambient_samples = ambient_sample_buffer_clone.get_latest(1024);
                        if ambient_samples.len() >= 1024 {
                            let mut planner = FftPlanner::new();
                            let fft = planner.plan_fft_forward(1024);
                            let mut ambient_fft_buffer: Vec<Complex<f32>> = ambient_samples.iter()
                                .take(1024)
                                .map(|&s| Complex::new(s, 0.0))
                                .collect();
                            fft.process(&mut ambient_fft_buffer);
                            
                            // Convert to frequency bins (same logic as music FFT)
                            let bins_per_bucket = 512 / FFT_SIZE;
                            for i in 0..FFT_SIZE {
                                let mut sum = 0.0f32;
                                for j in 0..bins_per_bucket {
                                    let idx = i * bins_per_bucket + j;
                                    if idx < 512 {
                                        sum += ambient_fft_buffer[idx].norm();
                                    }
                                }
                                let mag = sum / bins_per_bucket as f32;
                                let log_mag = (1.0 + mag * 50.0).ln() / 5.0;
                                ambient_frequencies[i] = log_mag.clamp(0.0, 1.0);
                            }
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
                    state.ambient_frequencies = ambient_frequencies;
                }
                
                // Check for commands (non-blocking with timeout)
                match command_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                    Ok(cmd) => match cmd {
                        AudioCommand::Play { file_path, track_info } => {
                            // Stop current track immediately (fade-out already happened or manual skip)
                            if let Some(old_sink) = current_sink.take() {
                                old_sink.stop();
                            }
                            
                            // Reset fade states for new track
                            fade_out_active = false;
                            
                            // Clear sample buffer for new track
                            sample_buffer_clone.clear();
                            
                            // Store current track info
                            *current_track_clone.lock() = Some(track_info);
                            
                            // Load and play new file
                            match File::open(&file_path) {
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
                                                    // Start at 0 volume and fade in if crossfade enabled
                                                    let start_vol = if crossfade_duration > 0.0 {
                                                        fade_in_progress = Some((Instant::now(), crossfade_duration));
                                                        0.0
                                                    } else if is_muted || is_master_muted {
                                                        0.0
                                                    } else {
                                                        music_volume * master_volume
                                                    };
                                                    sink.set_volume(start_vol);
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
                                Err(e) => eprintln!("Failed to open file {}: {}", file_path, e),
                            }
                        }
                        AudioCommand::Stop => {
                            if let Some(sink) = current_sink.take() {
                                sink.stop();
                            }
                            track_start = None;
                            *current_track_clone.lock() = None;
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
                        AudioCommand::SetCrossfadeDuration(duration) => {
                            crossfade_duration = duration;
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
                                    // Try to load from cache first, fall back to disk (read into memory)
                                    let bytes = if let Some(cached_bytes) = audio_cache.get(&file_a) {
                                        Some(cached_bytes.clone())
                                    } else {
                                        // Fall back to disk read into memory
                                        File::open(&file_a).ok().and_then(|mut f| {
                                            let mut bytes = Vec::new();
                                            f.read_to_end(&mut bytes).ok().map(|_| bytes)
                                        })
                                    };
                                    
                                    if let Some(bytes) = bytes {
                                    if let Ok(source) = Decoder::new(Cursor::new(bytes)) {
                                        // Apply pitch, pan, low-pass filter
                                        let sample_rate = source.sample_rate();
                                        let source = source.speed(settings.pitch).convert_samples::<f32>();
                                        let source = PannedSource::new(source, settings.pan);
                                        let source = LowPassSource::new(source, settings.low_pass_freq, sample_rate);
                                        
                                        let effective_vol = calc_ambient_volume(
                                            &settings, ambient_master_volume, master_volume,
                                            is_ambient_muted, is_master_muted
                                        );
                                        sink.set_volume(effective_vol);
                                        
                                        // Apply reverb then wrap with amplitude tracking
                                        let source = ReverbSource::new(source, settings.algorithmic_reverb, sample_rate);
                                        let source = AmbientAnalyzingSource::new(source, ambient_sample_buffer_clone.clone());
                                        sink.append(source);
                                        
                                        // Determine initial loop count
                                        let mut rng = rand::thread_rng();
                                        let loops = rng.gen_range(settings.repeat_min..=settings.repeat_max);
                                        
                                        ambient_states.insert(id.clone(), AmbientState {
                                            sink,
                                            file_a: file_a.clone(),
                                            file_b: file_b.clone(),
                                            settings: settings.clone(),
                                            is_playing_a: true,
                                            loops_remaining: loops,
                                            pause_remaining: 0.0,
                                            is_paused: false,
                                        });
                                        
                                        // Track in shared state for querying
                                        {
                                            let mut active = active_ambients_clone.lock();
                                            active.insert(id.clone(), ActiveAmbientInfo {
                                                id,
                                                file_a,
                                                file_b,
                                                settings,
                                            });
                                        }
                                    }
                                    }
                                }
                                Err(e) => eprintln!("Failed to create ambient sink: {}", e),
                            }
                        }
                        AudioCommand::StopAmbient(id) => {
                            // Start fade-out instead of immediate stop
                            if ambient_states.contains_key(&id) && !fading_out.contains_key(&id) {
                                fading_out.insert(id, 0.0);
                            }
                        }
                        AudioCommand::UpdateAmbientSettings { id, settings } => {
                            if let Some(state) = ambient_states.get_mut(&id) {
                                let pitch_changed = (state.settings.pitch - settings.pitch).abs() > 0.001;
                                let pan_changed = (state.settings.pan - settings.pan).abs() > 0.001;
                                let low_pass_changed = (state.settings.low_pass_freq - settings.low_pass_freq).abs() > 1.0;
                                let reverb_changed = (state.settings.algorithmic_reverb - settings.algorithmic_reverb).abs() > 0.001
                                    || state.settings.reverb_type != settings.reverb_type;
                                state.settings = settings.clone();
                                
                                // Update shared state with new settings
                                {
                                    let mut active = active_ambients_clone.lock();
                                    if let Some(info) = active.get_mut(&id) {
                                        info.settings = settings;
                                    }
                                }
                                
                                // If pitch, pan, low-pass, or reverb changed, restart current file with new settings
                                if pitch_changed || pan_changed || low_pass_changed || reverb_changed {
                                    state.sink.stop();
                                    // Create new sink
                                    if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                                        let file_path = if state.is_playing_a {
                                            &state.file_a
                                        } else {
                                            &state.file_b
                                        };
                                        // Try cache first, fall back to disk read into memory
                                        let bytes = if let Some(cached) = audio_cache.get(file_path) {
                                            Some(cached.clone())
                                        } else {
                                            File::open(file_path).ok().and_then(|mut f| {
                                                let mut b = Vec::new();
                                                f.read_to_end(&mut b).ok().map(|_| b)
                                            })
                                        };
                                        if let Some(bytes) = bytes {
                                        if let Ok(source) = Decoder::new(Cursor::new(bytes)) {
                                            let sample_rate = source.sample_rate();
                                            let source = source.speed(state.settings.pitch).convert_samples::<f32>();
                                            let source = PannedSource::new(source, state.settings.pan);
                                            let source = LowPassSource::new(source, state.settings.low_pass_freq, sample_rate);
                                            let effective_vol = calc_ambient_volume(
                                                &state.settings, ambient_master_volume, master_volume,
                                                is_ambient_muted, is_master_muted
                                            );
                                            new_sink.set_volume(effective_vol);
                                            let source = ReverbSource::new(source, state.settings.algorithmic_reverb, sample_rate);
                                            let source = AmbientAnalyzingSource::new(source, ambient_sample_buffer_clone.clone());
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
                        AudioCommand::PreloadAmbient(paths) => {
                            // Preload audio files into memory cache to avoid disk I/O during playback
                            for path in paths {
                                if !audio_cache.contains_key(&path) {
                                    if let Ok(mut file) = File::open(&path) {
                                        let mut bytes = Vec::new();
                                        if file.read_to_end(&mut bytes).is_ok() {
                                            audio_cache.insert(path, bytes);
                                        }
                                    }
                                }
                            }
                        }
                    },
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        // Process fade-outs for sounds being stopped
                        let mut completed_fades: Vec<String> = Vec::new();
                        for (id, progress) in fading_out.iter_mut() {
                            *progress += 1.0 / FADE_STEPS;
                            if let Some(state) = ambient_states.get(id) {
                                // Calculate faded volume (linear fade to 0)
                                let fade_multiplier = (1.0 - *progress).max(0.0);
                                let base_vol = calc_ambient_volume(
                                    &state.settings, ambient_master_volume, master_volume,
                                    is_ambient_muted, is_master_muted
                                );
                                state.sink.set_volume(base_vol * fade_multiplier);
                            }
                            if *progress >= 1.0 {
                                completed_fades.push(id.clone());
                            }
                        }
                        // Remove completed fades and stop their sinks
                        for id in completed_fades {
                            fading_out.remove(&id);
                            if let Some(state) = ambient_states.remove(&id) {
                                state.sink.stop();
                            }
                            // Remove from shared state
                            {
                                let mut active = active_ambients_clone.lock();
                                active.remove(&id);
                            }
                        }
                        
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
                                        // Play A (try cache first)
                                        let bytes = if let Some(cached) = audio_cache.get(&state.file_a) {
                                            Some(cached.clone())
                                        } else {
                                            File::open(&state.file_a).ok().and_then(|mut f| {
                                                let mut b = Vec::new();
                                                f.read_to_end(&mut b).ok().map(|_| b)
                                            })
                                        };
                                        if let Some(bytes) = bytes {
                                        if let Ok(source) = Decoder::new(Cursor::new(bytes)) {
                                            let sample_rate = source.sample_rate();
                                            let source = source.speed(state.settings.pitch).convert_samples::<f32>();
                                            let source = PannedSource::new(source, state.settings.pan);
                                            let source = LowPassSource::new(source, state.settings.low_pass_freq, sample_rate);
                                            let effective_vol = calc_ambient_volume(
                                                &state.settings, ambient_master_volume, master_volume,
                                                is_ambient_muted, is_master_muted
                                            );
                                            state.sink.set_volume(effective_vol);
                                            let source = ReverbSource::new(source, state.settings.algorithmic_reverb, sample_rate);
                                            let source = AmbientAnalyzingSource::new(source, ambient_sample_buffer_clone.clone());
                                            state.sink.append(source);
                                        }
                                        }
                                    }
                                } else if state.is_playing_a {
                                    // A finished, play B (try cache first)
                                    state.is_playing_a = false;
                                    let bytes = if let Some(cached) = audio_cache.get(&state.file_b) {
                                        Some(cached.clone())
                                    } else {
                                        File::open(&state.file_b).ok().and_then(|mut f| {
                                            let mut b = Vec::new();
                                            f.read_to_end(&mut b).ok().map(|_| b)
                                        })
                                    };
                                    if let Some(bytes) = bytes {
                                    if let Ok(source) = Decoder::new(Cursor::new(bytes)) {
                                        let sample_rate = source.sample_rate();
                                        let source = source.speed(state.settings.pitch).convert_samples::<f32>();
                                        let source = PannedSource::new(source, state.settings.pan);
                                        let source = LowPassSource::new(source, state.settings.low_pass_freq, sample_rate);
                                        let effective_vol = calc_ambient_volume(
                                            &state.settings, ambient_master_volume, master_volume,
                                            is_ambient_muted, is_master_muted
                                        );
                                        state.sink.set_volume(effective_vol);
                                        let source = ReverbSource::new(source, state.settings.algorithmic_reverb, sample_rate);
                                        let source = AmbientAnalyzingSource::new(source, ambient_sample_buffer_clone.clone());
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
                                            let bytes = if let Some(cached) = audio_cache.get(&state.file_a) {
                                                Some(cached.clone())
                                            } else {
                                                File::open(&state.file_a).ok().and_then(|mut f| {
                                                    let mut b = Vec::new();
                                                    f.read_to_end(&mut b).ok().map(|_| b)
                                                })
                                            };
                                            if let Some(bytes) = bytes {
                                            if let Ok(source) = Decoder::new(Cursor::new(bytes)) {
                                                let sample_rate = source.sample_rate();
                                                let source = source.speed(state.settings.pitch).convert_samples::<f32>();
                                                let source = PannedSource::new(source, state.settings.pan);
                                                let source = LowPassSource::new(source, state.settings.low_pass_freq, sample_rate);
                                                let effective_vol = calc_ambient_volume(
                                                    &state.settings, ambient_master_volume, master_volume,
                                                    is_ambient_muted, is_master_muted
                                                );
                                                state.sink.set_volume(effective_vol);
                                                let source = ReverbSource::new(source, state.settings.algorithmic_reverb, sample_rate);
                                                let source = AmbientAnalyzingSource::new(source, ambient_sample_buffer_clone.clone());
                                                state.sink.append(source);
                                            }
                                            }
                                        }
                                    } else {
                                        // More loops to go, play A again
                                        state.is_playing_a = true;
                                        let bytes = if let Some(cached) = audio_cache.get(&state.file_a) {
                                            Some(cached.clone())
                                        } else {
                                            File::open(&state.file_a).ok().and_then(|mut f| {
                                                let mut b = Vec::new();
                                                f.read_to_end(&mut b).ok().map(|_| b)
                                            })
                                        };
                                        if let Some(bytes) = bytes {
                                        if let Ok(source) = Decoder::new(Cursor::new(bytes)) {
                                            let sample_rate = source.sample_rate();
                                            let source = source.speed(state.settings.pitch).convert_samples::<f32>();
                                            let source = PannedSource::new(source, state.settings.pan);
                                            let source = LowPassSource::new(source, state.settings.low_pass_freq, sample_rate);
                                            let effective_vol = calc_ambient_volume(
                                                &state.settings, ambient_master_volume, master_volume,
                                                is_ambient_muted, is_master_muted
                                            );
                                            state.sink.set_volume(effective_vol);
                                            let source = ReverbSource::new(source, state.settings.algorithmic_reverb, sample_rate);
                                            let source = AmbientAnalyzingSource::new(source, ambient_sample_buffer_clone.clone());
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
        
        Self { 
            command_tx, 
            progress, 
            playback_state, 
            sample_buffer, 
            ambient_sample_buffer, 
            active_ambients, 
            current_track,
            playlist_state,
            playlists,
            all_tracks,
        }
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
    
    fn get_current_track(&self) -> Option<CurrentTrackInfo> {
        self.current_track.lock().clone()
    }
    
    fn get_playlist_state(&self) -> PlaylistState {
        self.playlist_state.lock().clone()
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
        visualization_type: default_visualization(),
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
fn play_music(
    state: tauri::State<Arc<AudioController>>,
    file_path: String,
    id: String,
    title: String,
    artist: String,
    album: String,
) -> Result<(), String> {
    let track_info = CurrentTrackInfo {
        id,
        title,
        artist,
        album,
        file_path: file_path.clone(),
    };
    state.send(AudioCommand::Play { file_path, track_info });
    Ok(())
}

#[tauri::command]
fn get_current_track(state: tauri::State<Arc<AudioController>>) -> Result<Option<CurrentTrackInfo>, String> {
    Ok(state.get_current_track())
}

// Playlist management commands
#[tauri::command]
fn get_playlist_state(state: tauri::State<Arc<AudioController>>) -> Result<PlaylistState, String> {
    Ok(state.get_playlist_state())
}

#[tauri::command]
fn load_saved_playlists_and_favorites(app: tauri::AppHandle, state: tauri::State<Arc<AudioController>>) -> Result<(), String> {
    // Load favorites from disk
    let favorites = load_favorites_from_disk(&app)?;
    state.playlist_state.lock().favorites = favorites;
    
    // Load playlists from disk
    let playlists = load_playlists_from_disk(&app)?;
    let mut playlist_map = state.playlists.lock();
    for playlist in playlists {
        playlist_map.insert(playlist.id.clone(), playlist);
    }
    
    Ok(())
}

#[tauri::command]
fn set_playlist_shuffle(state: tauri::State<Arc<AudioController>>, shuffled: bool) -> Result<(), String> {
    state.playlist_state.lock().is_shuffled = shuffled;
    Ok(())
}

#[tauri::command]
fn set_playlist_loop(state: tauri::State<Arc<AudioController>>, looping: bool) -> Result<(), String> {
    state.playlist_state.lock().is_looping = looping;
    Ok(())
}

#[tauri::command]
fn set_current_playlist(state: tauri::State<Arc<AudioController>>, playlist_id: Option<String>) -> Result<(), String> {
    let mut ps = state.playlist_state.lock();
    ps.current_playlist_id = playlist_id;
    ps.current_index = 0;
    ps.interrupted_index = None;
    Ok(())
}

#[tauri::command]
fn set_playlist_index(state: tauri::State<Arc<AudioController>>, index: i32) -> Result<(), String> {
    state.playlist_state.lock().current_index = index;
    Ok(())
}

#[tauri::command]
fn toggle_favorite(app: tauri::AppHandle, state: tauri::State<Arc<AudioController>>, track_id: String) -> Result<bool, String> {
    let mut ps = state.playlist_state.lock();
    let is_favorite = if let Some(pos) = ps.favorites.iter().position(|id| id == &track_id) {
        ps.favorites.remove(pos);
        false
    } else {
        ps.favorites.push(track_id);
        true
    };
    
    // Persist favorites to disk
    save_favorites_to_disk(&app, &ps.favorites)?;
    
    Ok(is_favorite)
}

#[tauri::command]
fn set_crossfade_duration(state: tauri::State<Arc<AudioController>>, duration: f32) -> Result<(), String> {
    state.send(AudioCommand::SetCrossfadeDuration(duration));
    Ok(())
}

#[tauri::command]
fn get_playlists(state: tauri::State<Arc<AudioController>>) -> Result<Vec<MusicPlaylist>, String> {
    let playlists = state.playlists.lock();
    Ok(playlists.values().cloned().collect())
}

#[tauri::command]
fn save_playlist(
    app: tauri::AppHandle,
    state: tauri::State<Arc<AudioController>>,
    id: String,
    name: String,
    tracks: Vec<PlaylistTrack>,
) -> Result<(), String> {
    // Don't allow overwriting auto playlists
    if id == "all-music" || id == "favorites" {
        return Err("Cannot modify auto playlists".to_string());
    }
    
    let playlist = MusicPlaylist {
        id: id.clone(),
        name,
        is_auto: false,
        tracks,
    };
    
    // Persist to disk
    save_playlist_to_disk(&app, &playlist)?;
    
    state.playlists.lock().insert(id, playlist);
    Ok(())
}

#[tauri::command]
fn delete_playlist(app: tauri::AppHandle, state: tauri::State<Arc<AudioController>>, id: String) -> Result<(), String> {
    // Don't allow deleting auto playlists
    if id == "all-music" || id == "favorites" {
        return Err("Cannot delete auto playlists".to_string());
    }
    
    // Delete from disk
    delete_playlist_from_disk(&app, &id)?;
    
    state.playlists.lock().remove(&id);
    Ok(())
}

#[tauri::command]
fn set_all_tracks(state: tauri::State<Arc<AudioController>>, tracks: Vec<PlaylistTrack>) -> Result<(), String> {
    *state.all_tracks.lock() = tracks;
    Ok(())
}

#[tauri::command]
fn get_all_tracks(state: tauri::State<Arc<AudioController>>) -> Result<Vec<PlaylistTrack>, String> {
    Ok(state.all_tracks.lock().clone())
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
    ambient_frequencies: Vec<f32>,
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
        ambient_frequencies: ps.ambient_frequencies,
    })
}

// Ambient sound commands
#[tauri::command]
fn get_active_ambients(
    state: tauri::State<Arc<AudioController>>,
) -> Result<Vec<ActiveAmbientInfo>, String> {
    let active = state.active_ambients.lock();
    Ok(active.values().cloned().collect())
}

#[tauri::command]
fn preload_ambient_sounds(
    state: tauri::State<Arc<AudioController>>,
    paths: Vec<String>,
) -> Result<(), String> {
    state.send(AudioCommand::PreloadAmbient(paths));
    Ok(())
}

#[tauri::command]
fn play_ambient(
    state: tauri::State<Arc<AudioController>>,
    id: String,
    file_a: String,
    file_b: String,
    volume: f32,
    pitch: Option<f32>,
    pan: Option<f32>,
    low_pass_freq: Option<f32>,
    reverb_type: Option<String>,
    algorithmic_reverb: Option<f32>,
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
        low_pass_freq: low_pass_freq.unwrap_or(22000.0),
        reverb_type: reverb_type.unwrap_or_else(|| "off".to_string()),
        algorithmic_reverb: algorithmic_reverb.unwrap_or(0.0),
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
    low_pass_freq: Option<f32>,
    reverb_type: Option<String>,
    algorithmic_reverb: Option<f32>,
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
        low_pass_freq: low_pass_freq.unwrap_or(22000.0),
        reverb_type: reverb_type.unwrap_or_else(|| "off".to_string()),
        algorithmic_reverb: algorithmic_reverb.unwrap_or(0.0),
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

// === Playlist & Favorites Persistence ===

fn get_playlists_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let playlists_dir = app_data.join("playlists");
    
    if !playlists_dir.exists() {
        fs::create_dir_all(&playlists_dir)
            .map_err(|e| format!("Failed to create playlists directory: {}", e))?;
    }
    
    Ok(playlists_dir)
}

fn get_favorites_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    if !app_data.exists() {
        fs::create_dir_all(&app_data)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }
    
    Ok(app_data.join("favorites.json"))
}

fn save_favorites_to_disk(app: &tauri::AppHandle, favorites: &[String]) -> Result<(), String> {
    let path = get_favorites_path(app)?;
    let content = serde_json::to_string_pretty(favorites)
        .map_err(|e| format!("Failed to serialize favorites: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write favorites file: {}", e))?;
    Ok(())
}

fn load_favorites_from_disk(app: &tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = get_favorites_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read favorites file: {}", e))?;
    let favorites: Vec<String> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse favorites: {}", e))?;
    Ok(favorites)
}

fn save_playlist_to_disk(app: &tauri::AppHandle, playlist: &MusicPlaylist) -> Result<(), String> {
    let playlists_dir = get_playlists_dir(app)?;
    let playlist_path = playlists_dir.join(format!("{}.playlist", &playlist.id));
    let content = serde_json::to_string_pretty(playlist)
        .map_err(|e| format!("Failed to serialize playlist: {}", e))?;
    fs::write(&playlist_path, content)
        .map_err(|e| format!("Failed to write playlist file: {}", e))?;
    Ok(())
}

fn delete_playlist_from_disk(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let playlists_dir = get_playlists_dir(app)?;
    let playlist_path = playlists_dir.join(format!("{}.playlist", id));
    if playlist_path.exists() {
        fs::remove_file(&playlist_path)
            .map_err(|e| format!("Failed to delete playlist file: {}", e))?;
    }
    Ok(())
}

fn load_playlists_from_disk(app: &tauri::AppHandle) -> Result<Vec<MusicPlaylist>, String> {
    let playlists_dir = get_playlists_dir(app)?;
    let mut playlists = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&playlists_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("playlist") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(playlist) = serde_json::from_str::<MusicPlaylist>(&content) {
                        playlists.push(playlist);
                    }
                }
            }
        }
    }
    
    Ok(playlists)
}

// === Preset Management Commands ===

fn get_presets_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let presets_dir = app_data.join("presets");
    
    if !presets_dir.exists() {
        fs::create_dir_all(&presets_dir)
            .map_err(|e| format!("Failed to create presets directory: {}", e))?;
    }
    
    Ok(presets_dir)
}

#[tauri::command]
fn list_presets(app: tauri::AppHandle) -> Result<Vec<PresetInfo>, String> {
    let presets_dir = get_presets_dir(&app)?;
    let mut presets = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&presets_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map(|e| e == "soundscape").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(preset) = serde_json::from_str::<SoundscapePreset>(&content) {
                        presets.push(PresetInfo {
                            id: preset.id,
                            name: preset.name,
                            created: preset.created,
                            modified: preset.modified,
                            sound_count: preset.sounds.len(),
                        });
                    }
                }
            }
        }
    }
    
    // Sort by name
    presets.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(presets)
}

#[tauri::command]
fn save_preset(app: tauri::AppHandle, name: String, sounds: Vec<PresetSound>) -> Result<PresetInfo, String> {
    let presets_dir = get_presets_dir(&app)?;
    
    // Generate ID from name (sanitized filename)
    let id: String = name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    
    let now = chrono::Utc::now().to_rfc3339();
    let preset_path = presets_dir.join(format!("{}.soundscape", &id));
    
    // Check if updating existing preset
    let (created, id) = if preset_path.exists() {
        if let Ok(content) = fs::read_to_string(&preset_path) {
            if let Ok(existing) = serde_json::from_str::<SoundscapePreset>(&content) {
                (existing.created, existing.id)
            } else {
                (now.clone(), id)
            }
        } else {
            (now.clone(), id)
        }
    } else {
        (now.clone(), id)
    };
    
    let preset = SoundscapePreset {
        id: id.clone(),
        name: name.clone(),
        created,
        modified: now,
        sounds: sounds.clone(),
    };
    
    let content = serde_json::to_string_pretty(&preset)
        .map_err(|e| format!("Failed to serialize preset: {}", e))?;
    
    fs::write(&preset_path, content)
        .map_err(|e| format!("Failed to write preset file: {}", e))?;
    
    Ok(PresetInfo {
        id: preset.id,
        name: preset.name,
        created: preset.created,
        modified: preset.modified,
        sound_count: preset.sounds.len(),
    })
}

#[tauri::command]
fn load_preset(app: tauri::AppHandle, id: String) -> Result<SoundscapePreset, String> {
    let presets_dir = get_presets_dir(&app)?;
    let preset_path = presets_dir.join(format!("{}.soundscape", &id));
    
    if !preset_path.exists() {
        return Err(format!("Preset '{}' not found", id));
    }
    
    let content = fs::read_to_string(&preset_path)
        .map_err(|e| format!("Failed to read preset file: {}", e))?;
    
    let preset: SoundscapePreset = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse preset: {}", e))?;
    
    Ok(preset)
}

#[tauri::command]
fn delete_preset(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let presets_dir = get_presets_dir(&app)?;
    let preset_path = presets_dir.join(format!("{}.soundscape", &id));
    
    if !preset_path.exists() {
        return Err(format!("Preset '{}' not found", id));
    }
    
    fs::remove_file(&preset_path)
        .map_err(|e| format!("Failed to delete preset: {}", e))?;
    
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // If main window is closed, exit the entire app
                if window.label() == "main" {
                    std::process::exit(0);
                }
            }
        })
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
            get_current_track,
            set_crossfade_duration,
            get_playlist_state,
            load_saved_playlists_and_favorites,
            set_playlist_shuffle,
            set_playlist_loop,
            set_current_playlist,
            set_playlist_index,
            toggle_favorite,
            get_playlists,
            save_playlist,
            delete_playlist,
            set_all_tracks,
            get_all_tracks,
            get_playback_state,
            get_active_ambients,
            preload_ambient_sounds,
            play_ambient,
            stop_ambient,
            update_ambient_settings,
            set_ambient_master_volume,
            set_ambient_muted,
            get_output_devices,
            list_presets,
            save_preset,
            load_preset,
            delete_preset
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
