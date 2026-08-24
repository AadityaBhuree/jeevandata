# Page Design System: Doctor Triage Hub & Clinical Briefs (`/dashboard`)

> **Overrides:** This file overrides `design-system/MASTER.md` for doctor and receptionist dashboards.

---

## 1. Page Purpose & Layout Structure

The operational clinical cockpit used by doctors, nurses, and clinic staff to review incoming triaged patients before they step into the consultation room.

### Visual Architecture (Desktop & Tablet)

- **Top KPI Metrics Strip (Bento Cards)**:
  - Total Patient Sessions Today (with live counter).
  - Average Intake Duration (e.g. 45s).
  - Triage Breakdown (Routine / Priority / Critical Red-Flags).
  - Real-time Socket & HL7 FHIR sync indicator.
- **Split Triage Cockpit**:
  - **Left Pane (Live Queue)**:
    - Real-time patient list sorted by urgency & arrival timestamp.
    - Mini photo avatar / match confidence tag.
    - Chief complaint preview snippet.
  - **Right Pane (Active Clinical Brief & Recommendations)**:
    - Patient Demographics & Known Allergies.
    - AI-Structured Chief Complaint and Symptom Timeline.
    - Risk Flags & Suggested Vitals to measure.
    - Suggested ICD-10 Diagnostic codes.
    - Post-consultation Diet & Nutrition prescription guidance.

---

## 2. Token & Component Specifics

| Element               | Class / Token                                                   | Purpose                                              |
| :-------------------- | :-------------------------------------------------------------- | :--------------------------------------------------- |
| **KPI Card**          | `glass-card p-4 card-hover-glow`                                | Clean overview without visual clutter.               |
| **Queue Item Active** | `border-l-4 border-l-sky-500 bg-sky-50/50 dark:bg-slate-800/60` | Clear indicator of currently selected patient brief. |
| **Triage Pill (Red)** | `bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300`  | Immediate visual warning for emergency cases.        |
