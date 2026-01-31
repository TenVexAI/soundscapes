# Kira Audio Library Refactor Proposal

## Overview

This document outlines a potential refactor of the Soundscapes audio backend from **rodio** to **Kira**, a Rust game audio library designed for real-time parameter control and smooth transitions.

**GitHub**: https://github.com/tesselode/kira

## Why Consider Kira?

### Current Limitations with rodio

1. **Parameter Changes Require Sound Restart**
   - Changing pitch, pan, or filter settings requires rebuilding the entire audio source chain
   - This causes brief audio interruptions during transitions
   - Currently mitigated by only smoothly transitioning volume

2. **Manual Fade Implementations**
   - We've built custom fade-in, fade-out, and volume transition code
   - Separate implementations for regular (~200ms) and scheduler (~2000ms) transitions
   - More code to maintain, potential for bugs

3. **Occasional Audio Static/Glitches**
   - Abrupt parameter changes can cause clicks
   - Buffer management is manual
   - Heavy load can cause audio underruns

### What Kira Provides

| Feature | Current (rodio) | With Kira |
|---------|-----------------|-----------|
| Pitch changes | Restart sound | Smooth, real-time |
| Volume transitions | Manual fade code | Built-in tweens |
| Pan changes | Restart sound | Real-time |
| Crossfading | Manual implementation | Native support |
| Multiple volume groups | Manual tracking | Native tracks |
| Parameter automation | DIY | First-class feature |
| Buffer management | Manual | Automatic |

## Scope of Refactor

### Files Affected

**Primary**: `src-tauri/src/lib.rs`
- Replace `rodio` imports with `kira`
- Rewrite `AudioController` and audio thread
- Replace `Sink`-based playback with Kira's `StaticSoundHandle`
- Reimplement all `AudioCommand` handlers

**Secondary**: `Cargo.toml`
- Remove `rodio` dependency
- Add `kira` dependency

**No Changes Required**:
- Frontend TypeScript code
- Tauri command signatures (API stays the same)
- Store implementations

### Components to Rewrite

1. **Music Playback**
   - Track loading and decoding
   - Play/pause/stop/seek
   - Volume control
   - Crossfade between tracks

2. **Ambient Sounds**
   - A/B file alternation system
   - Per-sound settings (volume, pitch, pan, filters)
   - Pause/repeat cycle logic
   - Master volume and muting

3. **Soundboard**
   - One-shot sound playback
   - Ducking system for ambient sounds

4. **Custom DSP**
   - Low-pass filter implementation
   - Reverb implementation
   - Pan control
   - These may need to be reimplemented as Kira effects or kept as custom processing

5. **FFT/Visualization**
   - Sample buffer access for spectrum analysis
   - May require custom Kira effect or different approach

## Kira Architecture Mapping

### Current rodio Structure
```
AudioController
├── command_tx (channel to audio thread)
└── Audio Thread
    ├── OutputStream
    ├── current_sink (music)
    ├── ambient_states: HashMap<String, AmbientState>
    │   └── AmbientState { sink, settings, ... }
    └── soundboard_sink
```

### Proposed Kira Structure
```
AudioController
├── command_tx (channel to audio thread)
└── Audio Thread
    ├── AudioManager
    ├── Tracks
    │   ├── music_track (with volume control)
    │   ├── ambient_track (with master volume)
    │   └── soundboard_track
    ├── ambient_sounds: HashMap<String, StaticSoundHandle>
    └── current_music: Option<StaticSoundHandle>
```

### Key Kira Concepts

```rust
// Creating the audio manager
let mut manager = AudioManager::<DefaultBackend>::new(AudioManagerSettings::default())?;

// Creating a track for volume grouping
let ambient_track = manager.add_sub_track(TrackBuilder::new())?;

// Loading and playing a sound
let sound_data = StaticSoundData::from_file("sound.wav")?;
let handle = manager.play(sound_data.with_settings(
    StaticSoundSettings::new()
        .track(&ambient_track)
        .volume(0.8)
        .playback_rate(1.2)  // pitch
        .panning(0.5)
))?;

// Real-time parameter changes (no restart needed!)
handle.set_volume(0.5, Tween {
    duration: Duration::from_secs(2),
    easing: Easing::Linear,
    ..Default::default()
});

handle.set_playback_rate(0.8, Tween { ... });
handle.set_panning(-0.3, Tween { ... });
```

## Estimated Effort

| Task | Complexity | Time Estimate |
|------|------------|---------------|
| Basic music playback | Medium | 2-4 hours |
| Ambient sound system | High | 6-10 hours |
| A/B alternation logic | Medium | 2-3 hours |
| Soundboard + ducking | Medium | 2-3 hours |
| Custom filters/reverb | High | 4-8 hours |
| FFT visualization | Medium | 2-4 hours |
| Testing & debugging | High | 4-8 hours |
| **Total** | | **22-40 hours** |

## Risks

1. **Custom DSP Complexity**
   - Our low-pass filter and reverb implementations may not port directly
   - May need to write custom Kira effects or find alternatives

2. **FFT Visualization**
   - Current implementation taps into the audio stream
   - Kira may require a different approach for sample access

3. **Learning Curve**
   - Kira's API is different from rodio
   - Track/clock/tween concepts need understanding

4. **Regression Risk**
   - Large refactor could introduce new bugs
   - Extensive testing required

## Benefits Summary

1. **Smoother Scheduler Transitions** - All parameters can transition smoothly, not just volume
2. **Cleaner Code** - Remove manual fade implementations
3. **Better Audio Quality** - Reduced glitches from proper buffer management
4. **Future Features** - Easier to add spatial audio, complex automation
5. **Maintainability** - Less custom audio code to maintain

## Recommendation

Consider this refactor when:
- Audio quality issues become a user complaint
- New features require real-time parameter control
- There's dedicated time for a focused audio rewrite

Not recommended if:
- Current audio quality is acceptable
- Limited development time
- Other features are higher priority

## Resources

- [Kira Documentation](https://docs.rs/kira/latest/kira/)
- [Kira GitHub](https://github.com/tesselode/kira)
- [Kira Examples](https://github.com/tesselode/kira/tree/main/examples)
