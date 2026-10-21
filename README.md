# ⚕️ MED-TRACE — Clinical Continuity Engine & Patient Treatment Journey

MED-TRACE is a unified, intelligent healthcare platform designed to bridge the critical gap between fragmented medical consultations, multi-doctor handovers, patient prescription records, and longitudinal treatment outcomes. It provides an unbroken digital chain of custody for a patient's health data — ensuring every physician has complete context and patients never miss a dose.

---

## 📖 Table of Contents
- [About the Project](#-about-the-project)
- [System Architecture & Tech Stack](#-system-architecture--tech-stack)
- [Core UI Pages & Significant Features](#-core-ui-pages--significant-features)
  - [1. Authentication & Onboarding Gate](#1-authentication--onboarding-gate)
  - [2. Global Topbar & Navigation System](#2-global-topbar--navigation-system)
  - [3. Patient & Doctor Dashboard](#3-patient--doctor-dashboard-dashboard)
  - [4. Doctor Treatment Records (Doctor A & Doctor B)](#4-doctor-treatment-records-doctora--doctorb)
  - [5. Clinical Handover Mode (Flagship USP)](#5-clinical-handover-mode-flagship-usp)
  - [6. Medical History & Longitudinal Background](#6-medical-history--longitudinal-background-history)
  - [7. Chronological Treatment Timeline](#7-chronological-treatment-timeline-timeline)
  - [8. Before vs. After Reports & Analytics](#8-before-vs-after-reports--analytics-reports)
  - [9. Medical Records & Diagnostic Scans Vault](#9-medical-records--diagnostic-scans-vault-records)
  - [10. Patient Profile & Emergency Registry](#10-patient-profile--emergency-registry-profile)
  - [11. Instant Pharmacy & Medicine Store](#11-instant-pharmacy--medicine-store-pharmacy)
  - [12. Real-Time Order Tracking](#12-real-time-order-tracking-orders)
  - [13. Medicine Reminders & Audio Notification Engine](#13-medicine-reminders--audio-notification-engine-reminders)
  - [14. "Ask My History" — Clinical Intelligence Assistant](#14-ask-my-history--clinical-intelligence-assistant)
- [Demo Credentials](#-demo-credentials)
- [Getting Started & Local Development](#-getting-started--local-development)
- [Security & Compliance Highlights](#-security--compliance-highlights)

---

## 💡 About the Project

In modern healthcare, patients frequently consult multiple specialists (e.g., an internal medicine doctor followed by a neurologist). Critical medical data often gets lost in transition:
- Previous drug reactions and side effects are forgotten.
- Conflicting drugs are co-prescribed.
- Physical diagnostic scans and paper prescriptions get misplaced.
- Patients struggle to adhere to complex medication schedules.

**MED-TRACE solves this clinical fragmentation** by offering a role-based, real-time medical dossier that tracks:
1. **Prescription Lifecycles**: Exact dosages, timing schedules, and documented outcome notes.
2. **Clinical Handovers**: Instant briefing syntheses between consulting physicians.
3. **Diagnostic Scans Repository**: High-resolution storage for X-Rays, MRIs, ECGs, and blood reports.
4. **Patient Medication Adherence**: Synchronized web notifications and acoustic chime alerts.
5. **Integrated Pharmacy**: 30–60 minute medicine delivery with stock monitoring and live order tracking.

---

## 🛠 System Architecture & Tech Stack

MED-TRACE is built with clean, standards-compliant web technologies ensuring high performance, zero build-step overhead, and offline resilience.

| Layer | Technologies & Implementations |
| :--- | :--- |
| **Frontend Core** | **HTML5** (Semantic structure, ARIA accessibility, micro-data) |
| **Logic & Modules** | **Vanilla JavaScript (ES6+)** organized into modular engines:<br>• `script.js` — Core state store, CRUD handlers, seed database, role-based access control.<br>• `features.js` — Handover generator, clinical detector, "Ask My History" search assistant.<br>• `pharmacy.js` — Pharmacy stock management, order dispatch, cart & pricing calculation.<br>• `reminders.js` — Audio synthesis chime alert, dosage scheduling & reminder loop. |
| **Styling & UI** | **Vanilla CSS3** (`style.css`, `features.css`, `Med Trace.css`)<br>• Custom Design Token System (HSL medical color palette, dark/light clinical tones).<br>• Glassmorphism effects, fluid CSS Grid & Flexbox layouts.<br>• Micro-animations: Animated SVG ECG telemetry waveform, ambient glowing orbs. |
| **PWA & Offline** | **Progressive Web App (PWA)**:<br>• `sw.js` — Service Worker caching strategy for offline availability and instant updates.<br>• `manifest.json` — Standalone mobile/desktop app manifest with maskable icons. |
| **Audio Engine** | **Web Audio API** (`AudioContext`): Synthesizes pleasant dual-frequency harmonic alert chimes (E5: 659.25Hz & A5: 880Hz) without external audio file dependencies. |
| **Notifications** | **Web Notifications API**: Native desktop and mobile push notifications for scheduled doses. |
| **Internationalization** | **Multi-Language Engine (i18n)** supporting real-time switching between **English (EN)**, **Hindi (हिंदी)**, and **Marathi (मराठी)**. |
| **Persistence** | **Browser `localStorage`** with fallback seed data for zero-config offline demonstrations and persistence across reloads. |
| **Document Export** | **Print CSS Engine (`@media print`)**: Formats high-fidelity clinical briefing PDFs and doctor handover sheets. |

---

## 🖥 Core UI Pages & Significant Features

### 1. Authentication & Onboarding Gate
- **Dual-Persona Sign-In**: Dedicated tabs for **Patient Login** and **Doctor Login**.
- **Multi-Method Verification**:
  - Standard Password Login.
  - **Phone OTP Verification**: Integrated mobile number input (`+91`), simulated SMS delivery countdown timer, and 1-click **Auto-fill** for streamlined testing.
- **1-Click Instant Demo Pills**: Direct bypass buttons for rapid stakeholder evaluation:
  - 🧑 `Aarav Sharma` (Patient · PAT-001)
  - 🩺 `Dr. Rajesh Verma` (Doctor A · Internal Medicine / Cardiology · DR-A)
  - 🩺 `Dr. Meena Kapoor` (Doctor B · Neurology · DR-B)
- **Visuals**: Animated clinical telemetry ECG baseline, ambient glowing light meshes, and compliance trust badges (HIPAA-ready, 256-bit AES encryption markers).

---

### 2. Global Topbar & Navigation System
- **Language Switcher Dropdown**: Instant dynamic translation across English, Hindi, and Marathi.
- **PDF Export Button**: Compiles the patient's entire medical record into a clean, printable medical summary document.
- **Role-Aware User Badge**: Displays the logged-in user's avatar, full name, and credential tag (e.g., *Patient*, *Internal Medicine — MBBS, MD*).
- **Responsive Sidebar**: Collapsible menu with live dynamic badges highlighting pending reminders, active pharmacy orders, and uploaded scans.

---

### 3. Patient & Doctor Dashboard (`#dashboard`)
- **Hero Clinical Banner**: Quick shortcut buttons to view prescriptions, medical history, upload scans, or inspect the treatment timeline.
- **Doctor-Only "Current Status" Card**: Automatically renders for logged-in physicians, highlighting the patient's current treatment phase, ongoing drugs, and last consultation notes.
- **Important History Alert Bar**: Real-time safety detector that flags high-risk allergies (e.g., *Severe Penicillin Allergy*), chronic illnesses (Hypertension), or surgical histories.
- **Key Health Metric Stats**:
  - Total Prescribed Medicines.
  - Active / Ongoing Medications.
  - Documented Outcome Efficacy Rate.
  - Medication Adherence Percentage.
- **Treatment Summary & Activity Stream**: Split view of ongoing interventions and an immutable chronological audit trail of all recent medical updates.

---

### 4. Doctor Treatment Records (`#doctorA` & `#doctorB`)
- **Doctor Profile Header**: Displays attending physician's credentials, hospital affiliation, years of experience, and net treatment outcome.
- **Medicine Cards with Outcome Tracking**:
  - Detailed drug specifications: Name, dosage, schedule (e.g., Morning 8:00 AM), duration, and date range.
  - **Documented Clinical Outcomes**: Qualitative review notes detailing symptom reduction, vitals impact, or adverse side effects.
  - Outcome Status Badges: *Positive*, *Mixed*, or *Needs Review*.
- **Role-Gated CRUD ("+ Add Medicine")**: Authenticated doctors can add or modify prescribed medicines, specify intake schedules, and append outcome notes.
- **Phase Outcome Summary**: Aggregated assessment of the therapeutic efficacy under each physician.

---

### 5. Clinical Handover Mode (Flagship USP)
- **Purpose**: Solves doctor-to-doctor transfer loss when a patient moves between medical specialists.
- **Synthesis Report**: Compiles a comprehensive briefing with one click:
  - Patient demographics & critical vitals (Blood group, age, emergency contact).
  - High-priority clinical flags and allergy warnings.
  - Cross-doctor medicine transition matrix (comparing Doctor A's discontinued regimen with Doctor B's active drugs).
  - Unresolved symptoms and clinical questions for the incoming physician.
- **Print & PDF Generation**: Includes a dedicated button to print or export the handover document for physical hospital records.

---

### 6. Medical History & Longitudinal Background (`#history`)
- **Categorized Clinical History**:
  - 🩺 **Past Illnesses**: Chronic conditions with diagnosis dates and management status.
  - 🏥 **Surgeries**: Procedures, dates, technique (e.g., laparoscopic), and recovery metrics.
  - 🩹 **Accidents & Physical Injuries**: Trauma history and rehabilitation details.
  - ⚠️ **Allergies**: High-alert allergy documentation (substance, severity, contraindications).
  - 🧬 **Family History**: Hereditary health risks across parents and relatives.
  - 💊 **Ongoing Treatments**: Active daily maintenance medications.
- **Interactive Editing**: Authorized users can edit and update medical background entries.

---

### 7. Chronological Treatment Timeline (`#timeline`)
- **Vertical Visual Milestone Line**: Visualizes the journey from first consultation through subsequent follow-ups.
- **Event Classification**: Differentiates between initial diagnoses, lab test milestones, medication start dates, adjustments, and clinical reviews.
- **Interactive Additions**: Allows doctors to log new treatment milestones and doctor-patient check-ins.

---

### 8. Before vs. After Reports & Analytics (`#reports`)
- **Comparative Treatment Analysis**: Tabbed interface comparing patient health metrics under Doctor A vs. Doctor B.
- **Documented Clinical Metrics**: Tracks measurable indices (e.g., systolic/diastolic blood pressure readings, pulse, headache frequency).
- **Clinical Governance Disclaimer**: Explicit notice distinguishing between documented follow-up observations and medical claims.

---

### 9. Medical Records & Diagnostic Scans Vault (`#records`)
- **Multi-Category Filter Tabs**:
  - 🩻 **X-Rays** (e.g., Chest X-Ray, Knee Joint).
  - 🩸 **Blood Reports** (Complete Blood Count, Lipid Profile).
  - 🧠 **MRI / CT Scans** (Brain MRI, Spine Scans).
  - 📄 **Prescriptions** (Signed physical copies).
  - 📋 **Other Documents** (Discharge summaries, insurance approvals).
- **Upload Engine**: File input with image preview, custom document naming, date assignment, doctor association, and notes.
- **Interactive Lightbox View**: Click any uploaded record to open a high-resolution inspection modal.

---

### 10. Patient Profile & Emergency Registry (`#profile`)
- **Demographics Overview**: Full name, Unique Patient ID (`PAT-001`), age, gender, blood group.
- **Emergency Contact Cards**: Primary contact details, verified phone number, residential address, and email.
- **Profile Management**: In-app modal to update address, phone, and emergency contact details.

---

### 11. Instant Pharmacy & Medicine Store (`#pharmacy`)
- **Inventory & Stock Management**:
  - Real-time stock filters: *All Medicines*, *Low Stock*, *Out of Stock*, *Available*.
  - Prominent **Stock Alert Banner** highlighting urgent restock needs.
- **Medicine Cards**: Displays brand/generic names, dosages, unit prices (₹ INR), availability badges, and an **"Order Now"** action.
- **Express 30–60 Minute Delivery**: Order checkout modal with quantity selector, total calculation, delivery address, and payment method selection (UPI, Cash on Delivery, Card).
- **Nearby Pharmacies Directory**: Live directory listing verified partner medical stores with operating status, distances, and customer ratings.

---

### 12. Real-Time Order Tracking (`#orders`)
- **Live Visual Stepper**: Tracks dispatched medicines through 5 sequential milestones:
  1. `Order Placed`
  2. `Confirmed`
  3. `Preparing`
  4. `Out for Delivery`
  5. `Delivered`
- **Dynamic Delivery ETA**: Displays delivery partner assignments, vehicle badges, and delivery timeframes.

---

### 13. Medicine Reminders & Audio Notification Engine (`#reminders`)
- **Web Audio Chime Alert**: Generates an acoustic synthesizer chime using the browser's Web Audio API (`659.25Hz` + `880Hz`), eliminating external audio file latency.
- **Browser Push Notifications**: Native desktop notifications notifying the patient when a dose is due.
- **"Today's Schedule" Grid**: Daily doses grouped by timing:
  - 🌅 *Morning* (e.g., 8:00 AM)
  - 🌤️ *Afternoon* (e.g., 1:00 PM)
  - 🌆 *Evening* (e.g., 6:00 PM)
  - 🌙 *Night* (e.g., 9:30 PM)
- **Instant Test Triggers**: Built-in test buttons (e.g., `⚡ Test Morning Dose`) to preview alerts and sound synthesis immediately.
- **Custom Reminder Scheduler**: Modal to create new recurring medicine alarms with dosage, frequency, and custom sound alerts.

---

### 14. "Ask My History" — Clinical Intelligence Assistant
- **Natural Language Medical Search**: Embedded assistant allowing patients to query their own medical chart.
- **Example Queries Answered**:
  - *"What did Doctor A prescribe for my blood pressure?"*
  - *"Do I have any recorded drug allergies?"*
  - *"When did I have my appendix surgery?"*
- **Instant Contextual Answers**: Extracts and presents exact timestamps, dosages, and contraindications directly from stored health records.

---

## 🔑 Demo Credentials

MED-TRACE is pre-configured with realistic clinical seed data:

| Role | Username / ID | Password | Phone (for OTP) | Specialization / Context |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | `PAT-001` | `patient123` | `9876543210` | Aarav Sharma (Age 32 · Blood B+) |
| **Doctor A** | `DR-A` | `docA123` | `9811122233` | Dr. Rajesh Verma (Internal Medicine) |
| **Doctor B** | `DR-B` | `docB123` | `9822233344` | Dr. Meena Kapoor (Neurology) |

> 💡 **Tip:** You can also use the **1-Click Demo Access** buttons on the login screen to sign in instantly without typing credentials.

---

## 🚀 Getting Started & Local Development

### Prerequisites
MED-TRACE has no heavy build tool requirements. Any standard web server or Python environment is sufficient.

### 1. Run via Python (Recommended)
From the project root directory:
```bash
python3 -m http.server 8085
```
Open your browser and navigate to:
```
http://localhost:8085/
```

### 2. Run via Node.js
```bash
npx -y serve -p 8085 .
```

### 3. Progressive Web App (PWA) Installation
When running over `http://localhost` or `https://`:
1. Click the **Install App** button or the browser install prompt in the address bar.
2. MED-TRACE will run as a standalone desktop/mobile application with offline capabilities powered by `sw.js`.

---

## 🛡️ Security & Compliance Highlights
- **Role-Based Access Control (RBAC)**: Strict segregation between Patient and Doctor interfaces. Sensitive actions (prescribing drugs, clinical notes, adding timeline events) are restricted to authenticated physicians.
- **Local Data Sovereignity**: All patient health metrics and medical scans are stored securely in client-side storage without transmitting private data to unauthorized third-party trackers.
- **Audit-Ready Logging**: Treatment modifications and dosage adjustments are recorded with timestamps and attending physician attribution.
