# Page Design System: Biometric & AI Voice Kiosk (`/intake`)

> **Overrides:** This file overrides `design-system/MASTER.md` for the `/intake` biometric & voice flow.

---

## 1. Page Purpose & Layout Structure

The physical clinic kiosk or mobile triage interface for contactless face detection, EAR blink liveness, and AI voice consultation.

### Visual Architecture

- **Top Header**: Step Progress Indicator (`1. Camera` $\rightarrow$ `2. Face Match` $\rightarrow$ `3. Voice Triage` $\rightarrow$ `4. Complete`).
- **Biometric Frame**:
  - Live MediaPipe camera canvas with glowing targeting ring (`#0284C7` scanning $\rightarrow$ `#16A34A` matched).
  - Anti-spoofing liveness badge with real-time EAR blink counter.
- **Voice Intake Interface**:
  - Center Animated Voice Orb (`<VoiceVisualizerOrb />`) with reactive audio waveform equalizer.
  - Multi-lingual spoken prompts with real-time transcript subtitles.
  - "Review Before Send" editable input bubble to prevent accidental AI transcription errors.
  - Emergency Alert banner if cardiac/severe dyspnea/bleeding red-flags are detected.
- **Completion Card**:
  - Personalized summary card with confirmation that the clinical brief was transferred to the doctor's queue.

---

## 2. Token & Interaction Specifics

| Element              | Class / Token                                     | Purpose                                         |
| :------------------- | :------------------------------------------------ | :---------------------------------------------- |
| **Scanning Border**  | `border-2 border-sky-400 animate-pulse`           | Guides patient to position face in oval guide.  |
| **Matched Border**   | `border-2 border-emerald-500 shadow-glow-emerald` | Immediate visual validation of identity vector. |
| **Voice Orb**        | `bg-gradient-to-tr from-sky-500 to-emerald-400`   | Warm, reassuring conversational centerpoint.    |
| **Emergency Banner** | `bg-rose-500/10 border-rose-500 text-rose-600`    | Immediate triage escalation notification.       |
