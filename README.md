# ⚕️ MED-TRACE — Clinical Continuity Engine & Patient Treatment Journey

MED-TRACE is a unified, intelligent healthcare platform designed to bridge the critical gap between fragmented medical consultations, multi-doctor handovers, patient prescription records, and longitudinal treatment outcomes. It provides an unbroken digital chain of custody for a patient's health data — ensuring every physician has complete context and patients never miss a dose.

---

## 📌 Executive Summary & Project Overview

| Attribute | Details |
| :--- | :--- |
| **Project Name** | **MED-TRACE (Medical Treatment & Continuity Engine)** |
| **Primary Goal** | Eliminate clinical data fragmentation and adverse drug interactions across multi-specialist handovers. |
| **Target Users** | **Patients** (personal health tracking, medication alarms, pharmacy) and **Doctors / Clinicians** (clinical records, handover briefs, diagnostics, timeline). |
| **Live Frontend** | [https://med-trace-beta.vercel.app](https://med-trace-beta.vercel.app) |
| **Live Backend API** | [https://med-trace-chso.onrender.com/api](https://med-trace-chso.onrender.com/api) |
| **Authentication Service** | Supabase Auth (`https://zyrrueipvunyvavjwugy.supabase.co`) + Instant Role-Based Demo Bypass |
| **Source Code Repo** | [https://github.com/MaitrixXD/MED-TRACE](https://github.com/MaitrixXD/MED-TRACE) |

---

## 🛠 Complete Technology Stack

| Layer / Domain | Technology | Implementation & Role |
| :--- | :--- | :--- |
| **Frontend Framework** | **Vanilla HTML5 & ES6+ JavaScript** | Zero-bundle-overhead, lightning-fast execution, native browser API compliance. |
| **Modular Logic** | `script.js` | Core application state controller, Supabase auth integration, CRUD operations, backend sync. |
| | `features.js` | Clinical Handover engine, allergy conflict detector, "Ask My History" natural query search. |
| | `pharmacy.js` | Medicine inventory filtering, cart calculations, order checkout, live tracking milestones. |
| | `reminders.js` | Web Audio synthesizer chime, dosage countdowns, push alert dispatcher. |
| **Styling & Design System** | **Vanilla CSS3** | Custom clinical HSL design tokens, glassmorphism, responsive grid/flexbox, print media styles (`@media print`). |
| **Backend & REST API** | **Node.js + Express.js** | Deployed on **Render** (`https://med-trace-chso.onrender.com/api`). Exposes endpoints for patient data, prescriptions, doctors, timeline, and pharmacy. |
| **Authentication Engine** | **Supabase Auth (v2 SDK)** | Cloud-managed authentication supporting Email/Password and SMS Phone OTP verification. |
| **Client Storage & Cache** | **Browser `localStorage`** | Offline-first persistence via key `medtrace_app_data_v1`, keeping user state across sessions and network drops. |
| **PWA & Offline Worker** | **Service Worker (`sw.js`)** | Caches application shell and clinical assets; supports Progressive Web App installation on mobile and desktop. |
| **Audio Notification Engine** | **Web Audio API (`AudioContext`)** | In-browser dual harmonic frequency chime synthesis (E5: 659.25Hz, A5: 880Hz) with zero external media files. |
| **Push Notifications** | **HTML5 Web Notifications API** | Native operating system desktop and mobile alert notifications for medication schedules. |
| **Internationalization (i18n)** | Custom JavaScript Dictionary | Instant client-side localization across **English (EN)**, **Hindi (हिंदी)**, and **Marathi (मराठी)**. |
| **Hosting & CI/CD** | **Vercel** (Frontend) + **Render** (Backend) | Automatic Git-backed deployments connected to `main` branch. |

---

## 🗄️ Database & Storage Architecture

### Where is the Data Stored?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MED-TRACE DATA TIERS                            │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ Tier 1: Client Persistence   │ Tier 2: Cloud Backend API    │ Tier 3: Auth  │
│ Browser `localStorage`       │ Render Express REST API      │ Supabase Auth │
│ Key: `medtrace_app_data_v1`  │ `https://med-trace-chso...`  │ JWT / OAuth   │
└──────────────────────────────┴──────────────────────────────┴───────────────┘
```

1. **Client Storage (`localStorage`)**:
   - Key: `medtrace_app_data_v1`
   - Role: Provides **offline-first instant access**, allowing doctors and patients to query and modify records even during network outages.
2. **Cloud REST Backend (Render)**:
   - Base URL: `https://med-trace-chso.onrender.com/api`
   - Role: Centralized API serving synchronized patient dossiers (`/api/patient`), treatment history, doctors, and pharmacy listings.
3. **Authentication Layer (Supabase)**:
   - Project URL: `https://zyrrueipvunyvavjwugy.supabase.co`
   - Role: Stores encrypted user identities, email credentials, phone OTP sessions, and role metadata (`patient` vs `doctor`).

---

### What Does the Database Store? (Schema Breakdown)

| Data Entity | Storage Location | Schema / Fields Stored | Clinical Significance |
| :--- | :--- | :--- | :--- |
| **Patient Profile** | `localStorage` + Backend `/api/patient` | `id`, `name`, `age`, `gender`, `blood`, `phone`, `email`, `address`, `emergencyContact` | Core demographic record and emergency contact routing. |
| **Medical History** | `appData.history` | `illness`, `surgery`, `accident`, `allergy`, `family`, `ongoing` | Permanent longitudinal background used for allergy and contraindication alerts. |
| **Doctor Profiles & Credentials** | `appData.doctors.A` & `B` | `id`, `name`, `spec`, `hospital`, `experience`, `phone`, `netOutcome` | Doctor attribution for every prescription change and clinical note. |
| **Prescription Records** | `appData.doctors[X].meds` | `id`, `name`, `dosage`, `schedule`, `days`, `startDate`, `endDate`, `reason`, `outcome`, `effectNote`, `followupDate` | Tracks drug efficacy (`Improved`, `Mixed`, `Worsened`), dosages, and treatment reasons. |
| **Treatment Timeline** | `appData.timeline` | `id`, `date`, `title`, `desc`, `outcome`, `doctor` ('A'/'B') | Chronological audit trail of visits, diagnosis shifts, and medicine changes. |
| **Diagnostic Scans & Vault** | `appData.documents` | `id`, `name`, `type` (X-Ray, MRI, Blood Report, Prescription), `date`, `doctor`, `dataUrl` / `base64`, `notes` | High-resolution medical imaging vault with in-browser lightbox inspection. |
| **Medicine Reminders** | `appData.reminders` | `id`, `medName`, `dosage`, `time`, `slot` (Morning, Afternoon, Evening, Night), `sound`, `active` | Active schedule for Web Audio chimes and native push notifications. |
| **Dose Compliance Log** | `appData.takenLog` | Map of `dateKey_reminderId` -> `timestamp` | Tracks whether doses were taken or missed for adherence calculation. |
| **Pharmacy Inventory** | `appData.pharmacy.inventory` | `id`, `name`, `generic`, `dosage`, `price`, `stock`, `category`, `deliveryTime` | Real-time stock status, low-stock warnings, and pricing. |
| **Pharmacy Orders** | `appData.pharmacy.orders` | `id`, `items`, `totalAmount`, `status` (Placed -> Confirmed -> Preparing -> Out for Delivery -> Delivered), `timestamp`, `eta` | Live delivery stepper and courier tracking. |

---

## ⚡ Core Features Matrix

| Feature | Target Persona | What it Does | Technology Used |
| :--- | :--- | :--- | :--- |
| **Dual Persona Gate** | Patient & Doctor | Role-based login with separate views for patient personal access and doctor clinical workstation. | Supabase Auth + Demo Pills |
| **Phone OTP Login** | Both | Passwordless login via SMS code verification with auto-fill testing. | Supabase Phone Auth + SMS simulator |
| **Clinical Handover Mode** | Doctors (USP) | 1-click synthesis of full patient history, discontinued vs active drugs, and open clinical questions. | `features.js` + `@media print` PDF generator |
| **Allergy & Conflict Detection** | Doctors & Patient | Real-time banner alert warning physicians about contraindications (e.g. Penicillin allergy). | Context analysis engine in `features.js` |
| **Prescription Outcome Tracking** | Doctors | Logs whether a medication resulted in *Improved*, *Mixed*, or *Worsened* outcomes with clinical notes. | `script.js` CRUD + State Store |
| **Visual Treatment Timeline** | Both | Milestone journey mapping every consultation, lab test, and prescription change since first visit. | CSS Grid / Flex Timeline |
| **Diagnostic Scans Vault** | Both | Multi-category storage for X-Rays, MRIs, Blood Reports, and Prescriptions with modal lightbox. | File API + Base64 LocalStorage |
| **Before vs After Analytics** | Both | Compares health metrics (e.g., blood pressure, pulse, headache frequency) across Doctor A vs Doctor B. | Comparative metric cards |
| **Web Audio Chime Alerts** | Patient | Harmonic chime synthesized in-browser when a dose is due without external MP3 files. | Web Audio API (`AudioContext`) |
| **Push Reminders** | Patient | Scheduled reminders for Morning, Afternoon, Evening, and Night doses with compliance logging. | Web Notifications API |
| **Instant Pharmacy & Orders** | Patient | 30–60 min medicine ordering with real-time 5-stage delivery stepper. | `pharmacy.js` State Machine |
| **"Ask My History" Assistant** | Both | Natural language search answering questions about past surgeries, allergies, and prescriptions. | Keyword & semantic matching in `features.js` |
| **Multi-Language (i18n)** | Both | Instant dynamic switching between English, Hindi, and Marathi across the entire UI. | Custom DOM i18n switcher |
| **PWA Offline Support** | Both | Standalone mobile and desktop app capability that works seamlessly offline. | Service Worker (`sw.js`) + Manifest |

---

## 🔑 Demo Credentials

MED-TRACE is pre-configured with realistic clinical seed data:

| Role | Username / ID | Password | Phone (for OTP) | Specialization / Context |
| :--- | :--- | :--- | :--- | :--- |
| **🧑 Patient** | `PAT-001` | `patient123` | `+91 98765 43210` | Aarav Sharma (Age 32 · Blood B+) |
| **👨‍⚕️ Doctor A** | `DR-A` | `docA123` | `+91 98111 22233` | Dr. Rajesh Verma (Internal Medicine) |
| **👩‍⚕️ Doctor B** | `DR-B` | `docB123` | `+91 98222 33344` | Dr. Meena Kapoor (Cardiology) |

> 💡 **Tip:** Click the **1-Click Demo Access** pill buttons on the login screen (`🧑 Aarav`, `🩺 Dr. Verma`, `🩺 Dr. Kapoor`) to bypass credential typing and jump straight into the application.

---

## 🚀 Getting Started & Local Development

### 1. Clone the Repository
```bash
git clone https://github.com/MaitrixXD/MED-TRACE.git
cd MED-TRACE
```

### 2. Run Locally via Python
```bash
python3 -m http.server 8085
```
Open your browser at `http://localhost:8085/`.

### 3. Run Locally via Node.js
```bash
npx -y serve -p 8085 .
```

### 4. Deploying Backend to Render
1. Connect your GitHub repository `MaitrixXD/MED-TRACE` to Render.
2. Create a new **Web Service**.
3. Set **Build Command**: `npm install` (or none if serving static Node).
4. Set **Start Command**: `node server.js`.
5. Add Environment Variables: `PORT=5000`, `FRONTEND_URL=https://med-trace-beta.vercel.app`.

---

## 🛡️ Security, Privacy & Compliance Highlights

- **Role-Based Access Control (RBAC)**: Strict segregation between Patient and Clinician privileges. Medical prescriptions, handover notes, and clinical outcomes can only be modified by authenticated doctors.
- **Client Data Sovereignty**: All sensitive records, scans, and adherence logs remain encrypted and sandboxed within user-controlled storage without unconsented third-party tracker exposure.
- **Audit-Ready Longitudinal Chain**: Every treatment modification is time-stamped and attributed to the issuing physician, ensuring clinical continuity and medico-legal traceability.
