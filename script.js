/* ═══════════════════════════════════════════════════════════
   MED-TRACE — Complete JavaScript Logic
   Role-based access | LocalStorage persistence | Full CRUD
═══════════════════════════════════════════════════════════ */
// Detect if running locally or deployed on Vercel
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : 'https://med-trace-chso.onrender.com/api';

/* ─────────────────────────────────────────────
   SUPABASE AUTHENTICATION ENGINE (Step 4 & 5)
───────────────────────────────────────────── */
const SUPABASE_URL = "https://zyrrueipvunyvavjwugy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cWH0RODSTl-xKSs1YF4SAg_byUIMGAc";

// Initialize Supabase Client
// NOTE: The CDN (@supabase/supabase-js@2) exports `window.supabase` as a namespace.
// We MUST NOT redeclare `const supabase` — it would cause:
//   SyntaxError: Identifier 'supabase' has already been declared
// which kills the ENTIRE script (no tab switching, no login, nothing works).
let supabaseClient = null;

function initSupabase() {
  if (!supabaseClient) {
    try {
      if (typeof window.supabase !== "undefined" && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("⚡ Supabase Auth client initialized successfully:", SUPABASE_URL);
      } else {
        console.warn("⚠️ Supabase SDK not loaded from CDN — auth features disabled, demo mode active.");
      }
    } catch (e) {
      console.warn("Supabase init error:", e, "— falling back to demo mode.");
      supabaseClient = null;
    }
  }
}
initSupabase();

// Supabase Email & Password Sign In Handler
async function handleSupabaseLogin(email, password, role = "patient") {
  const client = supabaseClient;
  if (!client) {
    console.warn("Supabase SDK not loaded");
    return { success: false, error: "Supabase not loaded" };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    showToast(`❌ Authentication failed: ${error.message}`, "error");
    return { success: false, error: error.message };
  }

  const user = data.user;
  const userRole = (user && user.user_metadata && user.user_metadata.role) || role;

  session.role = userRole;
  session.loggedIn = true;
  session.supabaseUser = user;

  localStorage.setItem("medtrace_supabase_user", JSON.stringify({
    id: user.id,
    email: user.email,
    role: userRole
  }));

  startApp();
  showToast(`🎉 Logged in via Supabase as ${userRole}!`, "success");
  return { success: true, user: user };
}

// Supabase Phone OTP Authentication
async function sendPhoneOTP(phoneNumber) {
  const client = supabaseClient;
  if (!client) return { error: "Supabase client unavailable" };

  const { data, error } = await client.auth.signInWithOtp({
    phone: phoneNumber
  });
  if (error) {
    showToast(`❌ OTP send failed: ${error.message}`, "error");
    return { error: error.message };
  }
  showToast(`📲 OTP dispatched via Supabase to ${phoneNumber}`, "success");
  return { data };
}

async function verifyPhoneOTP(phoneNumber, token) {
  const client = supabaseClient;
  if (!client) return { error: "Supabase client unavailable" };

  const { data: { session: otpSession }, error } = await client.auth.verifyOtp({
    phone: phoneNumber,
    token: token,
    type: "sms"
  });

  if (error) {
    showToast(`❌ OTP verification error: ${error.message}`, "error");
    return { error: error.message };
  }

  session.loggedIn = true;
  session.role = "patient";
  startApp();
  showToast("🎉 Phone OTP verified via Supabase!", "success");
  return { session: otpSession };
}

// Supabase Sign Out
async function logoutUser() {
  const client = supabaseClient;
  if (client) {
    await client.auth.signOut().catch(e => console.warn("Supabase signout:", e));
  }
  localStorage.removeItem("medtrace_supabase_user");
  session.loggedIn = false;
  location.reload();
}

let backendConnected = false;

async function checkBackendConnection() {
  const badge = document.getElementById("apiStatusBadge");
  const text = document.getElementById("apiStatusText");
  const loginText = document.getElementById("loginApiStatus");

  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    backendConnected = true;

    if (badge) {
      badge.className = "api-status-badge connected";
      badge.title = `Connected to Render Backend (${data.service})`;
    }
    if (text) text.textContent = "Live Cloud API";
    if (loginText) loginText.innerHTML = "🟢 Cloud API: Connected";
    console.log("⚕️ MED-TRACE Backend connected successfully:", API_BASE_URL, data);
    return true;
  } catch (err) {
    backendConnected = false;
    if (badge) {
      badge.className = "api-status-badge connecting";
      badge.title = "Connecting to Render Cloud (Service waking up...)";
    }
    if (text) text.textContent = "Cloud Connecting...";
    if (loginText) loginText.innerHTML = "🟡 Cloud API: Connecting...";
    console.warn("⚠️ Backend connecting or cold starting:", err.message);
    return false;
  }
}

async function syncFromBackend() {
  try {
    const isUp = await checkBackendConnection();
    if (!isUp) return;

    // 1. Fetch live patient record
    const pRes = await fetch(`${API_BASE_URL}/patient`);
    if (pRes.ok) {
      const pJson = await pRes.json();
      if (pJson && pJson.data) {
        if (pJson.data.vitals) appData.patient.vitals = pJson.data.vitals;
        console.log("⚕️ Patient data synced from backend");
      }
    }

    // 2. Fetch live medicines
    const mRes = await fetch(`${API_BASE_URL}/medicines`);
    if (mRes.ok) {
      const mJson = await mRes.json();
      if (mJson && mJson.data) {
        console.log(`⚕️ ${mJson.data.length} prescriptions verified with cloud database`);
      }
    }
    saveData();
  } catch (err) {
    console.warn("Background sync error (safe fallback to local):", err);
  }
}

async function syncMedicineToBackend(med, doctorKey) {
  try {
    const payload = {
      name: med.name,
      genericName: med.name,
      dosage: med.dosage,
      frequency: med.schedule,
      timing: med.schedule,
      doctor: doctorKey === "A" ? "DR-A" : "DR-B",
      doctorName: appData.doctors[doctorKey].name,
      outcome: med.outcome || "Prescription logged",
      effectNote: med.effectNote || ""
    };
    fetch(`${API_BASE_URL}/medicines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(e => console.warn("Async medicine sync:", e));
  } catch (e) { }
}

async function syncOrderToBackend(order) {
  try {
    const payload = {
      items: [{ name: order.medName, qty: order.qty, price: order.price }],
      totalAmount: order.price,
      deliveryAddress: order.address,
      paymentMethod: order.payment
    };
    fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(e => console.warn("Async order sync:", e));
  } catch (e) { }
}

/* ─────────────────────────────────────────────
   DEFAULT SEED DATA
───────────────────────────────────────────── */
const SEED = {
  patient: {
    id: "PAT-001",
    password: "patient123",
    name: "Aarav Sharma",
    age: 32,
    gender: "Male",
    blood: "B+",
    phone: "+91 98765 43210",
    email: "aarav.sharma@email.com",
    address: "12, Sector 5, New Delhi - 110001",
    emergencyContact: "Priya Sharma (+91 98765 11111)"
  },

  history: {
    illness: "Hypertension (High Blood Pressure) — Diagnosed January 2019. Currently managed with medication. No hospitalization required.",
    surgery: "Appendix removal (Appendectomy) — June 2015. Laparoscopic procedure, full recovery in 3 weeks. No complications.",
    accident: "Minor road accident — March 2020. Soft tissue injury to left shoulder. Physiotherapy done for 6 weeks. Fully recovered.",
    allergy: "Penicillin — Causes rash and mild anaphylaxis. Documented in 2018. Avoid all penicillin-based antibiotics.",
    family: "Father: Type 2 Diabetes, Heart Disease. Mother: Hypertension, Thyroid. No known cancer history in family.",
    ongoing: "Amlodipine 5mg — Once daily (night) for hypertension. Prescribed by Doctor B."
  },

  doctors: {
    A: {
      id: "DR-A",
      password: "docA123",
      phone: "+91 98111 22233",
      name: "Dr. Rajesh Verma",
      spec: "Internal Medicine — MBBS, MD",
      hospital: "Apollo Hospital, New Delhi",
      experience: "14 years",
      netOutcome: "Mixed",
      meds: [
        {
          id: "mA1",
          name: "Losartan 50mg",
          dosage: "50mg once daily",
          days: "30 days",
          schedule: "☀ Morning · 8:00 AM",
          startDate: "12 May 2024",
          endDate: "11 Jun 2024",
          reason: "To control blood pressure",
          outcome: "Worsened",
          effectNote: "Blood pressure did not improve. Patient reported dizziness and fatigue. Medicine discontinued after follow-up.",
          followupDate: "15 Jun 2024"
        },
        {
          id: "mA2",
          name: "Telmisartan 40mg",
          dosage: "40mg once daily",
          days: "30 days",
          schedule: "☀ Morning · 8:00 AM",
          startDate: "16 Jun 2024",
          endDate: "16 Jul 2024",
          reason: "Alternative after Losartan failure — better BP control",
          outcome: "Improved",
          effectNote: "Blood pressure stabilized to 128/82 after 2 weeks. Patient tolerated well with no side effects.",
          followupDate: "20 Jul 2024"
        }
      ]
    },
    B: {
      id: "DR-B",
      password: "docB123",
      phone: "+91 98222 33344",
      name: "Dr. Meena Kapoor",
      spec: "Cardiology — MBBS, MD, DM (Cardiology)",
      hospital: "AIIMS, New Delhi",
      experience: "19 years",
      netOutcome: "Improved",
      meds: [
        {
          id: "mB1",
          name: "Amlodipine 5mg",
          dosage: "5mg once daily",
          days: "Ongoing",
          schedule: "🌙 Night · 9:00 PM",
          startDate: "25 Jul 2024",
          endDate: "Ongoing",
          reason: "Calcium channel blocker — better for patient profile",
          outcome: "Improved",
          effectNote: "BP consistently at 122/78. No side effects. Patient reports improved energy levels and sleep quality.",
          followupDate: "30 Aug 2024"
        },
        {
          id: "mB2",
          name: "Aspirin 75mg",
          dosage: "75mg once daily",
          days: "30 days",
          schedule: "☀ Morning · 8:00 AM (after food)",
          startDate: "25 Jul 2024",
          endDate: "24 Aug 2024",
          reason: "Preventive antiplatelet therapy",
          outcome: "No Change",
          effectNote: "No adverse effects. Completed course. Discontinued after review as risk factors not significant enough.",
          followupDate: "28 Aug 2024"
        }
      ]
    }
  },

  timeline: [
    {
      id: "t1",
      date: "12 May 2024",
      title: "First Consultation — Doctor A",
      desc: "Patient visited Dr. Rajesh Verma with complaints of high blood pressure (BP: 158/96), mild headaches, and fatigue. Diagnosed with Stage 1 Hypertension.",
      outcome: "Worsened",
      doctor: "A"
    },
    {
      id: "t2",
      date: "11 Jun 2024",
      title: "Follow-up — Doctor A (Medicine Changed)",
      desc: "Follow-up visit. Losartan 50mg showed no improvement. BP still at 152/94. Medicine changed to Telmisartan 40mg after consultation.",
      outcome: "Mixed",
      doctor: "A"
    },
    {
      id: "t3",
      date: "16 Jul 2024",
      title: "Follow-up — Doctor A (Improved)",
      desc: "Telmisartan showing results. BP at 128/82. Patient referred to cardiologist (Doctor B) for specialist opinion.",
      outcome: "Improved",
      doctor: "A"
    },
    {
      id: "t4",
      date: "25 Jul 2024",
      title: "First Consultation — Doctor B",
      desc: "Dr. Meena Kapoor reviewed case. Switched to Amlodipine 5mg (better for patient profile) and added Aspirin 75mg as preventive care.",
      outcome: "Improved",
      doctor: "B"
    },
    {
      id: "t5",
      date: "30 Aug 2024",
      title: "Follow-up — Doctor B (Ongoing)",
      desc: "BP consistently at 122/78. Patient reports improved energy and sleep. Aspirin course completed and discontinued. Amlodipine continued.",
      outcome: "Improved",
      doctor: "B"
    }
  ],

  pharmacy: {
    medicines: [
      {
        id: "pm1",
        name: "Amlodipine 5mg",
        brand: "Amlod-5 (Sun Pharma)",
        price: 45,
        stock: "low",
        strips: 2,
        prescribed: true,
        doctorKey: "B",
        category: "Blood Pressure"
      },
      {
        id: "pm2",
        name: "Telmisartan 40mg",
        brand: "Telma-40 (Glenmark)",
        price: 120,
        stock: "out",
        strips: 0,
        prescribed: true,
        doctorKey: "A",
        category: "Blood Pressure"
      },
      {
        id: "pm3",
        name: "Aspirin 75mg",
        brand: "Ecosprin-75 (USV)",
        price: 25,
        stock: "available",
        strips: 8,
        prescribed: false,
        doctorKey: "B",
        category: "Antiplatelet"
      },
      {
        id: "pm4",
        name: "Losartan 50mg",
        brand: "Losar-H (Cipla)",
        price: 85,
        stock: "available",
        strips: 5,
        prescribed: false,
        doctorKey: "A",
        category: "Blood Pressure"
      },
      {
        id: "pm5",
        name: "Metoprolol 25mg",
        brand: "Metosartan (Dr. Reddy)",
        price: 60,
        stock: "low",
        strips: 1,
        prescribed: false,
        doctorKey: null,
        category: "Beta Blocker"
      },
      {
        id: "pm6",
        name: "Atorvastatin 10mg",
        brand: "Lipitor-10 (Pfizer)",
        price: 95,
        stock: "available",
        strips: 10,
        prescribed: false,
        doctorKey: null,
        category: "Cholesterol"
      }
    ],
    pharmacies: [
      { id: "f1", name: "MedPlus Pharmacy", icon: "🏥", distance: "0.4 km", rating: 4.8, time: "25-35 min", open: true },
      { id: "f2", name: "Apollo Pharmacy", icon: "💊", distance: "0.9 km", rating: 4.9, time: "30-45 min", open: true },
      { id: "f3", name: "Wellness Forever", icon: "🌿", distance: "1.2 km", rating: 4.6, time: "40-55 min", open: true }
    ],
    orders: []
  },

  reminders: [
    {
      id: "rem1",
      medName: "Medicine 1 (Pantoprazole 40mg)",
      dosage: "1 tablet",
      time: "07:30",
      label: "Morning",
      timeLabel: "Empty Stomach · Before Breakfast",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      doctor: "Dr. Rajesh Verma (A)",
      active: true,
      lastFired: null,
      color: "amber",
      notes: "Take 30 minutes before morning breakfast with a glass of water. Acid-reflux protection."
    },
    {
      id: "rem2",
      medName: "Medicine A (Telmisartan 40mg)",
      dosage: "1 tablet",
      time: "08:30",
      label: "Morning",
      timeLabel: "After Breakfast",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      doctor: "Dr. Rajesh Verma (A)",
      active: true,
      lastFired: null,
      color: "teal",
      notes: "Doctor A prescribed. Controls blood pressure. Take daily after breakfast. Do not crush."
    },
    {
      id: "rem3",
      medName: "Medicine 3 (Vitamin D3 60,000 IU)",
      dosage: "1 sachet in milk",
      time: "09:15",
      label: "Morning",
      timeLabel: "With Milk · Sundays",
      days: ["Sun"],
      doctor: "General Wellness",
      active: true,
      lastFired: null,
      color: "blue",
      notes: "Weekly bone & immunity booster. Mix in 200ml warm milk every Sunday morning."
    },
    {
      id: "rem4",
      medName: "Medicine C (Paracetamol 650mg)",
      dosage: "1 tablet",
      time: "13:30",
      label: "Afternoon",
      timeLabel: "After Lunch",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      doctor: "Dr. Rajesh Verma (A)",
      active: true,
      lastFired: null,
      color: "green",
      notes: "Doctor A prescribed for body ache & fever relief. Always take after food."
    },
    {
      id: "rem5",
      medName: "Medicine D (Multivitamin & Zinc)",
      dosage: "1 capsule",
      time: "17:30",
      label: "Evening",
      timeLabel: "With Evening Tea/Snack",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      doctor: "Dr. Meena Kapoor (B)",
      active: true,
      lastFired: null,
      color: "orange",
      notes: "Doctor B prescribed for immunity & energy recovery. Take with light snack."
    },
    {
      id: "rem6",
      medName: "Medicine B (Amlodipine 5mg)",
      dosage: "1 tablet",
      time: "21:00",
      label: "Night",
      timeLabel: "After Dinner · Before Bed",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      doctor: "Dr. Meena Kapoor (B)",
      active: true,
      lastFired: null,
      color: "indigo",
      notes: "Doctor B prescribed for evening blood pressure stability. Take consistently at 9:00 PM."
    },
    {
      id: "rem7",
      medName: "Medicine 7 (Atorvastatin 10mg)",
      dosage: "1 tablet",
      time: "22:00",
      label: "Night",
      timeLabel: "Before Sleep",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      doctor: "Dr. Meena Kapoor (B)",
      active: true,
      lastFired: null,
      color: "purple",
      notes: "Lipid and cholesterol management. Best absorbed during nighttime rest."
    }
  ],

  documents: []
};

/* ─────────────────────────────────────────────
   DATA LAYER (localStorage)
───────────────────────────────────────────── */
const STORAGE_KEY = "medtrace_v2";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Migrate reminders if missing or old format without Medicine 1
      if (!data.reminders || !Array.isArray(data.reminders) || !data.reminders.some(r => r.medName && r.medName.includes("Medicine 1"))) {
        data.reminders = JSON.parse(JSON.stringify(SEED.reminders));
      }
      if (!data.pharmacy) {
        data.pharmacy = JSON.parse(JSON.stringify(SEED.pharmacy));
      }
      if (!data.takenLog) {
        data.takenLog = {};
      }
      if (!data.documents || !Array.isArray(data.documents)) {
        data.documents = [];
      }
      if (data.doctors) {
        if (data.doctors.A && !data.doctors.A.phone) data.doctors.A.phone = "+91 98111 22233";
        if (data.doctors.B && !data.doctors.B.phone) data.doctors.B.phone = "+91 98222 33344";
      }
      return data;
    }
  } catch (e) { }
  return JSON.parse(JSON.stringify(SEED)); // deep clone seed
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

var appData = loadData();

/* ─────────────────────────────────────────────
   SESSION STATE
───────────────────────────────────────────── */
var session = {
  role: "patient", // default or 'doctorA' | 'doctorB'
  loggedIn: false
};

/* ─────────────────────────────────────────────
   LOGIN & PASSWORD VISIBILITY
───────────────────────────────────────────── */
const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_SLASH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  if (btn) {
    btn.innerHTML = isHidden ? EYE_SLASH_SVG : EYE_OPEN_SVG;
    const title = isHidden ? "Hide password" : "Show password";
    btn.setAttribute("title", title);
    btn.setAttribute("aria-label", title);
  }
}

function resetPasswordVisibility() {
  ["patientPw", "doctorPw"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.type = "password";
  });
  const btnP = document.getElementById("togglePatientPw");
  if (btnP) {
    btnP.innerHTML = EYE_OPEN_SVG;
    btnP.setAttribute("title", "Show password");
    btnP.setAttribute("aria-label", "Show password");
  }
  const btnD = document.getElementById("toggleDoctorPw");
  if (btnD) {
    btnD.innerHTML = EYE_OPEN_SVG;
    btnD.setAttribute("title", "Show password");
    btnD.setAttribute("aria-label", "Show password");
  }
}

function cleanPhoneNumber(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function switchTab(tab) {
  resetPasswordVisibility();
  const isPatient = (tab === "patient");
  const patientForm = document.getElementById("patientLoginForm");
  const doctorForm = document.getElementById("doctorLoginForm");
  const tabPatient = document.getElementById("tabPatient");
  const tabDoctor = document.getElementById("tabDoctor");
  const loginCard = document.getElementById("loginCard");
  const badge = document.getElementById("portalContextBadge");
  const badgeText = document.getElementById("portalBadgeText");

  if (patientForm) patientForm.classList.toggle("hidden", !isPatient);
  if (doctorForm) doctorForm.classList.toggle("hidden", isPatient);
  if (tabPatient) {
    tabPatient.classList.toggle("active", isPatient);
    tabPatient.setAttribute("aria-selected", isPatient ? "true" : "false");
  }
  if (tabDoctor) {
    tabDoctor.classList.toggle("active", !isPatient);
    tabDoctor.setAttribute("aria-selected", !isPatient ? "true" : "false");
  }
  if (loginCard) {
    loginCard.classList.toggle("doctor-mode", !isPatient);
  }
  if (badge && badgeText) {
    if (isPatient) {
      badge.className = "portal-context-badge";
      badgeText.textContent = "Patient Health Portal · Personal Access";
    } else {
      badge.className = "portal-context-badge portal-badge-doctor";
      badgeText.textContent = "Clinician Workstation · Diagnostic Suite";
    }
  }
  hideLoginAlerts();
}

function hideLoginAlerts() {
  const pAlert = document.getElementById("patientValidationAlert");
  const dAlert = document.getElementById("doctorValidationAlert");
  if (pAlert) { pAlert.classList.add("hidden"); pAlert.textContent = ""; }
  if (dAlert) { dAlert.classList.add("hidden"); dAlert.textContent = ""; }
}

function showLoginAlert(role, message) {
  const alertEl = document.getElementById(role === "patient" ? "patientValidationAlert" : "doctorValidationAlert");
  if (alertEl) {
    alertEl.textContent = message;
    alertEl.classList.remove("hidden");
  }
}

function setBtnLoading(btnId, isLoading, defaultText, loadingText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const spinner = btn.querySelector(".btn-login-spinner");
  const textEl = btn.querySelector(".btn-login-text");
  const arrow = btn.querySelector(".btn-arrow");
  btn.disabled = isLoading;
  if (spinner) spinner.classList.toggle("hidden", !isLoading);
  if (arrow) arrow.style.display = isLoading ? "none" : "";
  if (textEl) textEl.textContent = isLoading ? (loadingText || "Authenticating...") : defaultText;
}

/* ─────────────────────────────────────────────
   LOGIN METHOD SWITCHER (Password vs OTP)
───────────────────────────────────────────── */
function switchLoginMethod(role, method) {
  const isPatient = (role === "patient");
  const prefix = isPatient ? "patient" : "doctor";

  const pwBtn = document.getElementById(`${prefix}MethodPwBtn`);
  const otpBtn = document.getElementById(`${prefix}MethodOtpBtn`);
  const pwSection = document.getElementById(`${prefix}PwSection`);
  const otpSection = document.getElementById(`${prefix}OtpSection`);

  if (method === "pw") {
    if (pwBtn) pwBtn.classList.add("active");
    if (otpBtn) otpBtn.classList.remove("active");
    if (pwSection) pwSection.classList.remove("hidden");
    if (otpSection) otpSection.classList.add("hidden");
  } else {
    if (pwBtn) pwBtn.classList.remove("active");
    if (otpBtn) otpBtn.classList.add("active");
    if (pwSection) pwSection.classList.add("hidden");
    if (otpSection) otpSection.classList.remove("hidden");
  }
  hideLoginAlerts();
}

/* ─────────────────────────────────────────────
   ID & PASSWORD AUTHENTICATION (Supabase + Demo)
───────────────────────────────────────────── */
async function loginPatient() {
  hideLoginAlerts();
  const idEl = document.getElementById("patientId");
  const pwEl = document.getElementById("patientPw");
  const id = idEl ? idEl.value.trim() : "";
  const pw = pwEl ? pwEl.value : "";

  if (!id) {
    showLoginAlert("patient", "⚠️ Please enter your Patient ID or Supabase Email.");
    shakeFocus("patientId");
    return;
  }
  if (!pw) {
    showLoginAlert("patient", "⚠️ Please enter your account password.");
    shakeFocus("patientPw");
    return;
  }

  setBtnLoading("loginPatientBtn", true, "Sign in as Patient", "Verifying credentials...");

  // Try Supabase auth if an email is entered
  if (supabaseClient && supabaseClient.auth && id.includes("@")) {
    try {
      let { data, error } = await supabaseClient.auth.signInWithPassword({
        email: id,
        password: pw
      });

      // Auto sign-up in Supabase if the user does not exist yet
      if (error && (error.message.toLowerCase().includes("invalid login credentials") || error.status === 400)) {
        console.log("User not found in Supabase. Attempting auto-registration for:", id);
        const signUpRes = await supabaseClient.auth.signUp({
          email: id,
          password: pw,
          options: { data: { role: "patient", name: appData.patient.name } }
        });

        if (!signUpRes.error && signUpRes.data && signUpRes.data.user) {
          if (signUpRes.data.session) {
            data = signUpRes.data;
            error = null;
          } else {
            setBtnLoading("loginPatientBtn", false, "Sign in as Patient");
            showLoginAlert("patient", "📩 New account created in Supabase! If email confirmation is required, verify your inbox, or click the 🧑 Aarav (PAT-001) demo pill below.");
            showToast("Account created in Supabase! Check email.", "info");
            return;
          }
        } else if (signUpRes.error) {
          setBtnLoading("loginPatientBtn", false, "Sign in as Patient");
          showLoginAlert("patient", `❌ Supabase: ${signUpRes.error.message} (Demo alternative: Use 🧑 Aarav pill below)`);
          showToast(`❌ ${signUpRes.error.message}`, "error");
          shakeFocus("patientPw");
          return;
        }
      }

      if (!error && data && data.user) {
        session.role = "patient";
        session.loggedIn = true;
        session.supabaseUser = data.user;
        setBtnLoading("loginPatientBtn", false, "Sign in as Patient");
        startApp();
        showToast(`🎉 Logged in via Supabase: ${data.user.email}`, "success");
        return;
      } else if (error) {
        setBtnLoading("loginPatientBtn", false, "Sign in as Patient");
        showLoginAlert("patient", `❌ Supabase Auth: ${error.message}`);
        showToast(`❌ ${error.message}`, "error");
        shakeFocus("patientPw");
        return;
      }
    } catch (e) {
      console.warn("Supabase signIn error:", e);
    }
  }

  // Demo credential fallback
  setTimeout(() => {
    if (id === appData.patient.id && pw === appData.patient.password) {
      session.role = "patient";
      session.loggedIn = true;
      setBtnLoading("loginPatientBtn", false, "Sign in as Patient");
      startApp();
      showToast(`🎉 Welcome back, ${appData.patient.name}!`, "success");
    } else {
      setBtnLoading("loginPatientBtn", false, "Sign in as Patient");
      showLoginAlert("patient", "❌ Invalid credentials. Use 1-Click Demo pill below or valid Supabase email/password.");
      showToast("❌ Invalid Credentials", "error");
      shakeFocus("patientPw");
    }
  }, 300);
}

async function loginDoctor() {
  hideLoginAlerts();
  const idEl = document.getElementById("doctorId");
  const pwEl = document.getElementById("doctorPw");
  const id = idEl ? idEl.value.trim() : "";
  const pw = pwEl ? pwEl.value : "";

  if (!id) {
    showLoginAlert("doctor", "⚠️ Please enter your Doctor ID or Supabase Email.");
    shakeFocus("doctorId");
    return;
  }
  if (!pw) {
    showLoginAlert("doctor", "⚠️ Please enter your password.");
    shakeFocus("doctorPw");
    return;
  }

  setBtnLoading("loginDoctorBtn", true, "Sign in as Doctor", "Accessing Clinical Suite...");

  // Try Supabase auth if an email is entered
  if (supabaseClient && supabaseClient.auth && id.includes("@")) {
    try {
      let { data, error } = await supabaseClient.auth.signInWithPassword({
        email: id,
        password: pw
      });

      if (error && (error.message.toLowerCase().includes("invalid login credentials") || error.status === 400)) {
        const isB = id.toLowerCase().includes("b") || id.toLowerCase().includes("meena");
        const docRole = isB ? "doctorB" : "doctorA";
        const docName = isB ? appData.doctors.B.name : appData.doctors.A.name;
        const signUpRes = await supabaseClient.auth.signUp({
          email: id,
          password: pw,
          options: { data: { role: docRole, name: docName } }
        });
        if (!signUpRes.error && signUpRes.data && signUpRes.data.user) {
          if (signUpRes.data.session) {
            data = signUpRes.data;
            error = null;
          } else {
            setBtnLoading("loginDoctorBtn", false, "Sign in as Doctor");
            showLoginAlert("doctor", "📩 Doctor account created in Supabase! If confirmation is on, check your inbox or use 1-Click Dr. A pill.");
            return;
          }
        }
      }

      if (!error && data && data.user) {
        const isB = id.toLowerCase().includes("b") || id.toLowerCase().includes("meena");
        session.role = isB ? "doctorB" : "doctorA";
        session.loggedIn = true;
        session.supabaseUser = data.user;
        setBtnLoading("loginDoctorBtn", false, "Sign in as Doctor");
        startApp();
        showToast(`🎉 Logged in via Supabase as ${session.role === "doctorA" ? "Dr. Rajesh Verma" : "Dr. Meena Kapoor"}!`, "success");
        return;
      } else if (error) {
        setBtnLoading("loginDoctorBtn", false, "Sign in as Doctor");
        showLoginAlert("doctor", `❌ Supabase: ${error.message}`);
        showToast(`❌ ${error.message}`, "error");
        shakeFocus("doctorPw");
        return;
      }
    } catch (e) {
      console.warn("Supabase signIn error:", e);
    }
  }

  setTimeout(() => {
    const upperId = id.toUpperCase();
    if (upperId === "DR-A" && pw === appData.doctors.A.password) {
      session.role = "doctorA";
      session.loggedIn = true;
      setBtnLoading("loginDoctorBtn", false, "Sign in as Doctor");
      startApp();
      showToast(`🎉 Welcome, ${appData.doctors.A.name}!`, "success");
    } else if (upperId === "DR-B" && pw === appData.doctors.B.password) {
      session.role = "doctorB";
      session.loggedIn = true;
      setBtnLoading("loginDoctorBtn", false, "Sign in as Doctor");
      startApp();
      showToast(`🎉 Welcome, ${appData.doctors.B.name}!`, "success");
    } else {
      setBtnLoading("loginDoctorBtn", false, "Sign in as Doctor");
      showLoginAlert("doctor", "❌ Invalid Doctor credentials. Demo: DR-A (docA123) or DR-B (docB123) or Supabase Email.");
      showToast("❌ Invalid Doctor ID or Password", "error");
      shakeFocus("doctorPw");
    }
  }, 300);
}

/* ─────────────────────────────────────────────
   PHONE NUMBER + OTP AUTHENTICATION
───────────────────────────────────────────── */
var loginOtpState = {
  patient: { code: "123456", timer: null, timeLeft: 0 },
  doctor: { code: "123456", timer: null, timeLeft: 0 }
};

function sendLoginOtp(role) {
  const isPatient = (role === "patient");
  const phoneEl = document.getElementById(isPatient ? "patientPhone" : "doctorPhone");
  if (!phoneEl) return;
  const rawPhone = phoneEl.value.trim();
  const phone = cleanPhoneNumber(rawPhone);

  if (!phone || phone.length < 10) {
    showToast("❌ Please enter a valid 10-digit registered mobile number.", "error");
    shakeFocus(phoneEl.id);
    return;
  }

  // Verification against registered accounts
  if (isPatient) {
    const regPhone = cleanPhoneNumber(appData.patient.phone || "9876543210");
    if (phone !== regPhone) {
      showToast(`❌ Mobile number not registered for Patient. Demo: ${regPhone}`, "error");
      shakeFocus("patientPhone");
      return;
    }
  } else {
    const docAPhone = cleanPhoneNumber((appData.doctors && appData.doctors.A && appData.doctors.A.phone) || "9811122233");
    const docBPhone = cleanPhoneNumber((appData.doctors && appData.doctors.B && appData.doctors.B.phone) || "9822233344");
    if (phone !== docAPhone && phone !== docBPhone) {
      showToast(`❌ Mobile number not registered for Doctor. Demo: ${docAPhone} (Dr. A) or ${docBPhone} (Dr. B)`, "error");
      shakeFocus("doctorPhone");
      return;
    }
  }

  // Generate 6-digit OTP
  const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
  loginOtpState[role].code = generatedCode;

  // Reveal OTP box
  const boxId = isPatient ? "patientOtpBox" : "doctorOtpBox";
  const box = document.getElementById(boxId);
  if (box) box.classList.remove("hidden");

  // Update demo code display
  const demoCodeEl = document.getElementById(isPatient ? "patientOtpDemoCode" : "doctorOtpDemoCode");
  if (demoCodeEl) demoCodeEl.textContent = generatedCode;

  // Start countdown timer
  startLoginOtpTimer(role);

  showToast(`📲 OTP sent to +91 ${phone}: ${generatedCode}`, "success");

  const otpInput = document.getElementById(isPatient ? "patientOtp" : "doctorOtp");
  if (otpInput) {
    otpInput.value = "";
    otpInput.focus();
  }
}

function startLoginOtpTimer(role) {
  const isPatient = (role === "patient");
  const timerEl = document.getElementById(isPatient ? "patientOtpTimer" : "doctorOtpTimer");
  const sendBtn = document.getElementById(isPatient ? "btnSendPatientOtp" : "btnSendDoctorOtp");

  if (loginOtpState[role].timer) clearInterval(loginOtpState[role].timer);

  loginOtpState[role].timeLeft = 30;
  if (sendBtn) sendBtn.disabled = true;

  const tick = () => {
    if (loginOtpState[role].timeLeft > 0) {
      if (timerEl) timerEl.textContent = `Resend in ${loginOtpState[role].timeLeft}s`;
      if (sendBtn) sendBtn.innerHTML = `<span>⏳ Resend in ${loginOtpState[role].timeLeft}s</span>`;
      loginOtpState[role].timeLeft--;
    } else {
      clearInterval(loginOtpState[role].timer);
      if (timerEl) timerEl.textContent = "";
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>📲 Resend Login OTP</span>`;
      }
    }
  };
  tick();
  loginOtpState[role].timer = setInterval(tick, 1000);
}

function autoFillOtp(role) {
  const isPatient = (role === "patient");
  const otpInput = document.getElementById(isPatient ? "patientOtp" : "doctorOtp");
  if (otpInput) {
    otpInput.value = loginOtpState[role].code || "123456";
    showToast("✨ OTP auto-filled!", "success");
  }
}

function verifyLoginOtp(role) {
  const isPatient = (role === "patient");
  const btnId = isPatient ? "verifyPatientOtpBtn" : "verifyDoctorOtpBtn";
  const otpInput = document.getElementById(isPatient ? "patientOtp" : "doctorOtp");
  const enteredOtp = otpInput ? otpInput.value.trim() : "";
  const validCode = loginOtpState[role].code;

  if (!enteredOtp) {
    showToast("❌ Please enter the 6-digit verification OTP.", "error");
    if (otpInput) shakeFocus(otpInput.id);
    return;
  }

  setBtnLoading(btnId, true, "Verify OTP & Sign In", "Validating OTP...");

  setTimeout(() => {
    // Allow either generated OTP or universal fallback 123456
    if (enteredOtp !== validCode && enteredOtp !== "123456") {
      setBtnLoading(btnId, false, "Verify OTP & Sign In");
      showToast("❌ Invalid OTP. Please use the code sent or demo code 123456.", "error");
      if (otpInput) shakeFocus(otpInput.id);
      return;
    }

    setBtnLoading(btnId, false, "Verify OTP & Sign In");

    if (isPatient) {
      session.role = "patient";
      session.loggedIn = true;
      startApp();
      showToast(`🎉 Welcome back, ${appData.patient.name}!`, "success");
    } else {
      const phoneEl = document.getElementById("doctorPhone");
      const phone = phoneEl ? cleanPhoneNumber(phoneEl.value) : "";
      const docAPhone = cleanPhoneNumber((appData.doctors && appData.doctors.A && appData.doctors.A.phone) || "9811122233");
      const docBPhone = cleanPhoneNumber((appData.doctors && appData.doctors.B && appData.doctors.B.phone) || "9822233344");

      if (phone === docBPhone) {
        session.role = "doctorB";
        session.loggedIn = true;
        startApp();
        showToast(`🎉 Welcome, ${appData.doctors.B.name}!`, "success");
      } else {
        session.role = "doctorA";
        session.loggedIn = true;
        startApp();
        showToast(`🎉 Welcome, ${appData.doctors.A.name}!`, "success");
      }
    }
  }, 350);
}

function quickLogin(role) {
  if (role === 'patient') {
    switchTab('patient');
    switchLoginMethod('patient', 'pw');
    const idEl = document.getElementById('patientId');
    const pwEl = document.getElementById('patientPw');
    if (idEl) idEl.value = (appData && appData.patient && appData.patient.id) || 'PAT-001';
    if (pwEl) pwEl.value = (appData && appData.patient && appData.patient.password) || 'patient123';
    loginPatient();
  } else if (role === 'doctorA') {
    switchTab('doctor');
    switchLoginMethod('doctor', 'pw');
    const idEl = document.getElementById('doctorId');
    const pwEl = document.getElementById('doctorPw');
    if (idEl) idEl.value = 'DR-A';
    if (pwEl) pwEl.value = (appData && appData.doctors && appData.doctors.A && appData.doctors.A.password) || 'docA123';
    loginDoctor();
  } else if (role === 'doctorB') {
    switchTab('doctor');
    switchLoginMethod('doctor', 'pw');
    const idEl = document.getElementById('doctorId');
    const pwEl = document.getElementById('doctorPw');
    if (idEl) idEl.value = 'DR-B';
    if (pwEl) pwEl.value = (appData && appData.doctors && appData.doctors.B && appData.doctors.B.password) || 'docB123';
    loginDoctor();
  }
}

function shakeFocus(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "#e74c3c";
  el.focus();
  setTimeout(() => { el.style.borderColor = ""; }, 2000);
}

/* ─────────────────────────────────────────────
   FORGOT PASSWORD VIA PHONE NUMBER + NEW PASSWORD
───────────────────────────────────────────── */
var fpState = {
  phone: "",
  target: null, // { type: 'patient'|'doctorA'|'doctorB', name: string }
  otp: "123456"
};

function openForgotPassword(role) {
  fpState.target = null;
  fpState.otp = "123456";

  let defaultPhone = "";
  if (role === "patient") {
    defaultPhone = (appData.patient && appData.patient.phone) ? cleanPhoneNumber(appData.patient.phone) : "9876543210";
  } else {
    defaultPhone = (appData.doctors && appData.doctors.A && appData.doctors.A.phone) ? cleanPhoneNumber(appData.doctors.A.phone) : "9811122233";
  }

  const patientPhone = cleanPhoneNumber((appData.patient && appData.patient.phone) || "9876543210");
  const docAPhone = cleanPhoneNumber((appData.doctors && appData.doctors.A && appData.doctors.A.phone) || "9811122233");
  const docBPhone = cleanPhoneNumber((appData.doctors && appData.doctors.B && appData.doctors.B.phone) || "9822233344");

  const content = `
    <div class="fp-container">
      <div class="fp-header-icon">🔐</div>
      <div class="fp-title">Reset Your Password</div>
      <div class="fp-subtitle">Enter your registered mobile number to verify your identity and set a new password.</div>

      <!-- Step 1: Phone input -->
      <div id="fpStepPhone">
        <div class="form-group" style="text-align:left;margin-bottom:12px;">
          <label for="fpPhoneInput">Registered Mobile Number</label>
          <div class="input-with-icon">
            <span class="input-icon">📱</span>
            <input id="fpPhoneInput" type="tel" placeholder="e.g. 9876543210" value="${defaultPhone}">
          </div>
        </div>

        <div class="fp-quick-pills">
          <span class="fp-quick-label">Or choose demo account:</span>
          <div class="fp-pills-row">
            <button type="button" class="fp-pill" onclick="selectFpPhone('patient')">
              🧑 Patient (${patientPhone})
            </button>
            <button type="button" class="fp-pill" onclick="selectFpPhone('doctorA')">
              🩺 Dr. A (${docAPhone})
            </button>
            <button type="button" class="fp-pill" onclick="selectFpPhone('doctorB')">
              🩺 Dr. B (${docBPhone})
            </button>
          </div>
        </div>

        <button type="button" class="btn-login" style="margin-top:14px;" onclick="sendForgotPasswordOtp()">
          <span>Send Verification OTP</span>
          <span class="btn-arrow">→</span>
        </button>
      </div>

      <!-- Step 2: OTP + New Password (revealed after phone is entered and OTP sent) -->
      <div id="fpStepReset" class="hidden">
        <div class="fp-phone-badge" id="fpPhoneBadge">
          <span>📲 OTP sent to <strong id="fpTargetPhone"></strong></span>
          <button type="button" class="fp-change-phone-btn" onclick="backToFpPhoneStep()">Change</button>
        </div>

        <div class="otp-hint-banner" style="margin-bottom:14px;">
          <span>Demo Verification OTP: <strong id="fpDemoOtpCode">123456</strong></span>
          <button type="button" class="btn-otp-autofill" onclick="autoFillFpOtp()">Auto-fill</button>
        </div>

        <div class="form-group" style="text-align:left;">
          <label for="fpOtpInput">Enter 6-digit OTP</label>
          <div class="input-with-icon">
            <span class="input-icon">🔢</span>
            <input id="fpOtpInput" type="text" maxlength="6" placeholder="Enter OTP (e.g. 123456)">
          </div>
        </div>

        <div class="form-group" style="text-align:left;">
          <label for="fpNewPwInput">New Password</label>
          <div class="input-with-icon pw-input-wrapper">
            <span class="input-icon">🔒</span>
            <input id="fpNewPwInput" type="password" placeholder="Enter new password (min 4 characters)">
            <button type="button" class="btn-toggle-pw" onclick="togglePasswordVisibility('fpNewPwInput', this)" title="Show password">
              ${EYE_OPEN_SVG}
            </button>
          </div>
        </div>

        <div class="form-group" style="text-align:left;">
          <label for="fpConfirmPwInput">Confirm New Password</label>
          <div class="input-with-icon pw-input-wrapper">
            <span class="input-icon">🔒</span>
            <input id="fpConfirmPwInput" type="password" placeholder="Re-enter new password">
            <button type="button" class="btn-toggle-pw" onclick="togglePasswordVisibility('fpConfirmPwInput', this)" title="Show password">
              ${EYE_OPEN_SVG}
            </button>
          </div>
        </div>

        <button type="button" class="btn-login" style="margin-top:14px;" onclick="submitForgotPasswordReset()">
          <span>Update & Save Password</span>
          <span class="btn-arrow">✓</span>
        </button>
      </div>
    </div>`;

  const overlay = document.getElementById("modal");
  const card = document.getElementById("modalCard");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  if (!overlay || !body) return;
  title.textContent = "Forgot Password Recovery";
  body.innerHTML = content;
  overlay.classList.remove("hidden");
  card.classList.remove("modal-handover");
}

function selectFpPhone(target) {
  const input = document.getElementById("fpPhoneInput");
  if (!input) return;
  if (target === "patient") {
    input.value = cleanPhoneNumber(appData.patient.phone || "9876543210");
  } else if (target === "doctorA") {
    input.value = cleanPhoneNumber((appData.doctors && appData.doctors.A && appData.doctors.A.phone) || "9811122233");
  } else if (target === "doctorB") {
    input.value = cleanPhoneNumber((appData.doctors && appData.doctors.B && appData.doctors.B.phone) || "9822233344");
  }
}

function sendForgotPasswordOtp() {
  const phoneInput = document.getElementById("fpPhoneInput");
  if (!phoneInput) return;
  const raw = phoneInput.value.trim();
  const phone = cleanPhoneNumber(raw);

  if (!phone || phone.length < 10) {
    showToast("❌ Please enter a valid 10-digit registered mobile number.", "error");
    shakeFocus("fpPhoneInput");
    return;
  }

  const patPhone = cleanPhoneNumber(appData.patient.phone || "9876543210");
  const docAPhone = cleanPhoneNumber((appData.doctors && appData.doctors.A && appData.doctors.A.phone) || "9811122233");
  const docBPhone = cleanPhoneNumber((appData.doctors && appData.doctors.B && appData.doctors.B.phone) || "9822233344");

  let target = null;
  if (phone === patPhone) {
    target = { type: "patient", name: appData.patient.name };
  } else if (phone === docAPhone) {
    target = { type: "doctorA", name: appData.doctors.A.name };
  } else if (phone === docBPhone) {
    target = { type: "doctorB", name: appData.doctors.B.name };
  } else {
    showToast("❌ Mobile number not found. Please check registered numbers.", "error");
    shakeFocus("fpPhoneInput");
    return;
  }

  const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
  fpState.phone = phone;
  fpState.target = target;
  fpState.otp = generatedOtp;

  document.getElementById("fpStepPhone").classList.add("hidden");
  const stepReset = document.getElementById("fpStepReset");
  stepReset.classList.remove("hidden");

  document.getElementById("fpTargetPhone").textContent = `+91 ${phone} (${target.name})`;
  document.getElementById("fpDemoOtpCode").textContent = generatedOtp;

  showToast(`📲 Reset OTP sent to +91 ${phone}: ${generatedOtp}`, "success");
}

function autoFillFpOtp() {
  const otpInput = document.getElementById("fpOtpInput");
  if (otpInput) {
    otpInput.value = fpState.otp || "123456";
    showToast("✨ OTP auto-filled!", "success");
  }
}

function backToFpPhoneStep() {
  const stepPhone = document.getElementById("fpStepPhone");
  const stepReset = document.getElementById("fpStepReset");
  if (stepPhone) stepPhone.classList.remove("hidden");
  if (stepReset) stepReset.classList.add("hidden");
}

function submitForgotPasswordReset() {
  const otpInput = document.getElementById("fpOtpInput");
  const newPwInput = document.getElementById("fpNewPwInput");
  const confirmPwInput = document.getElementById("fpConfirmPwInput");

  const enteredOtp = otpInput ? otpInput.value.trim() : "";
  const newPw = newPwInput ? newPwInput.value : "";
  const confirmPw = confirmPwInput ? confirmPwInput.value : "";

  if (!enteredOtp) {
    showToast("❌ Please enter the OTP.", "error");
    shakeFocus("fpOtpInput");
    return;
  }
  if (enteredOtp !== fpState.otp && enteredOtp !== "123456") {
    showToast("❌ Incorrect OTP. Use generated code or 123456.", "error");
    shakeFocus("fpOtpInput");
    return;
  }
  if (!newPw || newPw.length < 4) {
    showToast("❌ Password must be at least 4 characters.", "error");
    shakeFocus("fpNewPwInput");
    return;
  }
  if (newPw !== confirmPw) {
    showToast("❌ Passwords do not match. Please re-enter.", "error");
    shakeFocus("fpConfirmPwInput");
    return;
  }

  // Save new password
  if (fpState.target.type === "patient") {
    appData.patient.password = newPw;
    saveData();
    const patPwEl = document.getElementById("patientPw");
    if (patPwEl) patPwEl.value = newPw;
    showToast(`🎉 Password for ${fpState.target.name} updated! You can now log in.`, "success");
  } else if (fpState.target.type === "doctorA") {
    appData.doctors.A.password = newPw;
    saveData();
    const docPwEl = document.getElementById("doctorPw");
    if (docPwEl) docPwEl.value = newPw;
    showToast(`🎉 Password for ${fpState.target.name} (Dr. A) updated!`, "success");
  } else if (fpState.target.type === "doctorB") {
    appData.doctors.B.password = newPw;
    saveData();
    const docPwEl = document.getElementById("doctorPw");
    if (docPwEl) docPwEl.value = newPw;
    showToast(`🎉 Password for ${fpState.target.name} (Dr. B) updated!`, "success");
  }

  closeModal();
}



function logout() {
  if (supabaseClient && supabaseClient.auth) {
    supabaseClient.auth.signOut().catch(e => console.warn("Supabase signout:", e));
  }
  session = { role: null, loggedIn: false };
  document.getElementById("app").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");
  switchTab("patient");
  showToast("You have been logged out.", "success");
}

/* ─────────────────────────────────────────────
   START APP
───────────────────────────────────────────── */
function startApp() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  renderAll();
  showSection("dashboard", document.getElementById("nav-dashboard"));
}

function isDoctor() { return session.role === "doctorA" || session.role === "doctorB"; }
function isDoctorA() { return session.role === "doctorA"; }
function isDoctorB() { return session.role === "doctorB"; }

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
function showSection(id, btn) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (btn) btn.classList.add("active");

  // Re-render section
  if (id === "doctorA") renderDoctorSection("A");
  if (id === "doctorB") renderDoctorSection("B");
  if (id === "history") renderHistory();
  if (id === "timeline") renderTimeline();
  if (id === "reports") renderReport("A");
  if (id === "records") renderRecords();
  if (id === "profile") renderProfile();
  if (id === "pharmacy") renderPharmacy();
  if (id === "orders") renderOrders();
  if (id === "reminders" && typeof renderReminders === "function") renderReminders();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

/* ─────────────────────────────────────────────
   RENDER ALL — also renders pharmacy
───────────────────────────────────────────── */
function renderAll() {
  renderTopbar();
  renderDashboard();
  renderDoctorSection("A");
  renderDoctorSection("B");
  renderHistory();
  renderTimeline();
  renderRecords();
  renderProfile();
  renderNavBadges();
  renderPharmacy();
  renderOrders();
  if (typeof renderReminders === "function") renderReminders();
  showEditButtons();
}

function renderTopbar() {
  const p = appData.patient;
  const patientName = translateClinical(p.name);
  const docAName = translateClinical(appData.doctors.A.name);
  const docBName = translateClinical(appData.doctors.B.name);
  const roleMap = {
    patient: { name: patientName, role: t("rolePatient", "Patient"), initial: p.name[0] },
    doctorA: { name: docAName, role: t("roleDocA", "Doctor A — Editor"), initial: "A" },
    doctorB: { name: docBName, role: t("roleDocB", "Doctor B — Editor"), initial: "B" }
  };
  const r = roleMap[session.role] || roleMap.patient;
  document.getElementById("userName").textContent = r.name;
  document.getElementById("userRole").textContent = r.role;
  document.getElementById("userAvatar").textContent = r.initial;
  document.getElementById("sidebarPatientId").textContent = t("patientLabel", "Patient") + ": " + p.id;
}

function renderNavBadges() {
  document.getElementById("badgeA").textContent = appData.doctors.A.meds.length;
  document.getElementById("badgeB").textContent = appData.doctors.B.meds.length;

  // Records badge
  const recBadge = document.getElementById("badgeRecords");
  if (recBadge) {
    const docCount = (appData.documents || []).length;
    recBadge.textContent = docCount > 0 ? docCount : "";
  }

  // Pharmacy alert badge: count low+out of stock
  const alertCount = appData.pharmacy.medicines.filter(m => m.stock !== "available").length;
  const pharBadge = document.getElementById("badgePharmacy");
  if (pharBadge) {
    if (alertCount > 0) {
      pharBadge.textContent = alertCount;
      pharBadge.style.display = "";
    } else {
      pharBadge.style.display = "none";
    }
  }

  // Orders badge
  const activeOrders = (appData.pharmacy.orders || []).filter(o => o.status !== "delivered" && o.status !== "cancelled").length;
  const orderBadge = document.getElementById("badgeOrders");
  if (orderBadge) orderBadge.textContent = activeOrders > 0 ? activeOrders : "";

  // Reminders badge
  const activeRem = (appData.reminders || []).filter(r => r.active).length;
  const remBadge = document.getElementById("badgeReminders");
  if (remBadge) remBadge.textContent = activeRem > 0 ? activeRem : "";
}

function showEditButtons() {
  // Edit history: both doctors can edit
  const eHist = document.getElementById("editHistoryBtn");
  if (eHist) eHist.classList.toggle("hidden", !isDoctor());

  // Edit profile: both doctors can edit
  const eProf = document.getElementById("editProfileBtn");
  if (eProf) eProf.classList.toggle("hidden", !isDoctor());

  // Add medicine A: only doctorA
  const addA = document.getElementById("addMedABtn");
  if (addA) addA.classList.toggle("hidden", !isDoctorA());

  // Add medicine B: only doctorB
  const addB = document.getElementById("addMedBBtn");
  if (addB) addB.classList.toggle("hidden", !isDoctorB());

  // Add timeline entry: both doctors
  const addTL = document.getElementById("addTimelineBtn");
  if (addTL) addTL.classList.toggle("hidden", !isDoctor());
}

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
function renderDashboard() {
  renderStatsGrid();
  renderTreatmentSummary();
  renderRecentActivity();
}

function renderStatsGrid() {
  const p = appData.patient;
  const totalMeds = appData.doctors.A.meds.length + appData.doctors.B.meds.length;
  const improved = [...appData.doctors.A.meds, ...appData.doctors.B.meds]
    .filter(m => m.outcome === "Improved").length;
  const docCount = (appData.documents || []).length;

  const stats = [
    { icon: "💊", label: t("dashStatMeds", "Total Medicines"), value: totalMeds, sub: t("statAcrossBoth", "Across both doctors"), cls: "info" },
    { icon: "✅", label: t("dashStatImproved", "Improved Outcomes"), value: improved, sub: `${t("statOutOf", "Out of")} ${totalMeds} ${t("statMedsWord", "medicines")}`, cls: "good" },
    { icon: "📁", label: t("dashStatRecords", "Medical Records"), value: docCount, sub: t("statUploadedScans", "Scans & blood reports"), cls: "good" },
    { icon: "📋", label: t("dashStatTimeline", "Timeline Events"), value: appData.timeline.length, sub: t("statTreatmentEntries", "Treatment entries"), cls: "info" }
  ];

  document.getElementById("statsGrid").innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-label"><span class="stat-icon">${s.icon}</span>${s.label}</div>
      <div class="stat-value ${s.cls}">${s.value}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>
  `).join("");
}

function renderTreatmentSummary() {
  const dA = appData.doctors.A;
  const dB = appData.doctors.B;
  const docAName = translateClinical(dA.name);
  const docBName = translateClinical(dB.name);
  const netA = translateOutcome(dA.netOutcome);
  const netB = translateOutcome(dB.netOutcome);
  const ongoingText = translateClinical(appData.history.ongoing);
  const pastText = translateClinical(appData.history.illness.split('.')[0]);

  document.getElementById("treatmentSummary").innerHTML = `
    <div class="summary-item">
      <div class="summary-dot"></div>
      <div>
        <div class="summary-label">${t("treatmentDocA", "Doctor A")} — ${docAName}</div>
        <div class="summary-value">${dA.meds.map(m => m.name).join(", ")} · ${t("netOutcome", "Net Outcome")}: <strong>${netA}</strong></div>
      </div>
    </div>
    <div class="summary-item">
      <div class="summary-dot teal"></div>
      <div>
        <div class="summary-label">${t("treatmentDocB", "Doctor B")} — ${docBName}</div>
        <div class="summary-value">${dB.meds.map(m => m.name).join(", ")} · ${t("netOutcome", "Net Outcome")}: <strong>${netB}</strong></div>
      </div>
    </div>
    <div class="summary-item">
      <div class="summary-dot"></div>
      <div>
        <div class="summary-label">${t("currentOngoingMed", "Current Ongoing Medicine")}</div>
        <div class="summary-value">${ongoingText}</div>
      </div>
    </div>
    <div class="summary-item">
      <div class="summary-dot"></div>
      <div>
        <div class="summary-label">${t("pastMedicalHist", "Past Medical History")}</div>
        <div class="summary-value">${pastText}</div>
      </div>
    </div>
  `;
}

function renderRecentActivity() {
  const items = appData.timeline.slice(-3).reverse();
  document.getElementById("recentActivity").innerHTML = items.map(tItem => `
    <div class="activity-item">
      <div class="activity-icon">${tItem.doctor === "A" ? "👨‍⚕️" : "👩‍⚕️"}</div>
      <div>
        <div class="activity-text">${translateClinical(tItem.title)}</div>
        <div class="activity-time">${tItem.date} · ${outcomeLabel(tItem.outcome)}</div>
      </div>
    </div>
  `).join("") || `<p style='color:var(--ink-muted);font-size:13px'>${t("noRecentActivity", "No recent activity.")}</p>`;
}

/* ─────────────────────────────────────────────
   DOCTOR SECTIONS
───────────────────────────────────────────── */
function renderDoctorSection(key) {
  const d = appData.doctors[key];
  const imgSrc = key === "A" ? "doctor_a.jpg" : "doctor_b.jpg";
  const section = key === "A" ? "doctorA" : "doctorB";
  const canEdit = (key === "A" && isDoctorA()) || (key === "B" && isDoctorB());

  const docName = translateClinical(d.name);
  const docSpec = translateClinical(d.spec);
  const docHosp = translateClinical(d.hospital);
  const docExp = translateClinical(d.experience);

  // Title
  document.getElementById(`doctor${key}Title`).textContent = docName;
  document.getElementById(`doctor${key}Spec`).textContent = docSpec;

  // Doctor A/B edit info for doctors
  const actionsEl = document.getElementById(`doctor${key}Actions`);
  if (actionsEl && canEdit) {
    actionsEl.innerHTML = `
      <button class="btn-edit" onclick="openEditDoctorInfo('${key}')">${t("editInfoBtn", "✏ Edit Info")}</button>
    `;
  } else if (actionsEl) {
    actionsEl.innerHTML = "";
  }

  // Profile card
  document.getElementById(`doctor${key}Profile`).innerHTML = `
    <img src="${imgSrc}" alt="${docName}" class="doctor-avatar" onerror="this.style.display='none'">
    <div class="doctor-info-wrap">
      <div class="doctor-name">${docName}</div>
      <div class="doctor-spec">${docSpec}</div>
      <div class="doctor-meta">
        <div class="doctor-meta-item">
          <span class="meta-label">${t("hospitalLabel", "Hospital")}</span>
          <span class="meta-value">${docHosp}</span>
        </div>
        <div class="doctor-meta-item">
          <span class="meta-label">${t("expLabel", "Experience")}</span>
          <span class="meta-value">${docExp}</span>
        </div>
        <div class="doctor-meta-item">
          <span class="meta-label">${t("netOutcome", "Net Outcome")}</span>
          <span class="outcome-badge ${outcomeClass(d.netOutcome)}">${outcomeIcon(d.netOutcome)} ${translateOutcome(d.netOutcome)}</span>
        </div>
      </div>
    </div>
  `;

  // Medicines
  const medsEl = document.getElementById(`medicines${key}`);
  // Get timeline visits for this doctor
  const doctorVisits = appData.timeline.filter(ti => ti.doctor === key);

  if (d.meds.length === 0) {
    medsEl.innerHTML = `<div class="medicines-empty">${t("noMedsYet", "No medicines prescribed yet.")}</div>`;
  } else {
    // Disease treated (from first medicine reason)
    const diseaseTreated = d.meds[0] ? translateClinical(d.meds[0].reason) : "";

    // Visit count header
    const visitCountBadge = doctorVisits.length > 0
      ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;background:var(--blue-50);border-radius:10px;border:1px solid var(--blue-100);">
          <span style="font-size:13px;font-weight:700;color:var(--blue-700)">🏥 Disease / Condition Treated:</span>
          <span style="font-size:13px;color:var(--ink)">${esc(diseaseTreated)}</span>
          <span style="margin-left:auto;font-size:12px;background:var(--blue-600);color:#fff;border-radius:20px;padding:2px 10px;font-weight:700">${doctorVisits.length} Visit${doctorVisits.length > 1 ? "s" : ""}</span>
        </div>`
      : diseaseTreated ? `<div style="margin-bottom:14px;padding:10px 14px;background:var(--blue-50);border-radius:10px;border:1px solid var(--blue-100);font-size:13px;color:var(--ink)"><span style="font-weight:700;color:var(--blue-700)">🏥 Disease Treated: </span>${esc(diseaseTreated)}</div>` : "";

    medsEl.innerHTML = visitCountBadge + d.meds.map((m, i) => {
      // Find the timeline visit that matches this medicine's start date
      const matchingVisit = doctorVisits.find(v => v.date === m.startDate) || doctorVisits[i] || null;

      return `
      <div class="medicine-card" id="med-${m.id}">
        <div class="med-name">
          ${m.name}
          <span class="med-dosage">${translateSchedule(m.dosage)}</span>
          <span style="display:inline-block;background:var(--blue-600);color:#fff;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:800;margin-left:4px;">${esc(m.days || "—")}</span>
        </div>
        ${matchingVisit ? `
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--blue-500);margin:8px 0 4px;">Visit Date</div>
        <div style="font-size:12px;color:var(--ink-muted);margin-bottom:8px;">📅 ${esc(matchingVisit.date)} — ${translateClinical(matchingVisit.title)}</div>
        ` : ""}
        <div class="med-meta">
          <span class="med-meta-label">${t("scheduleLabel", "Schedule")}</span>
          <span class="med-meta-value">${translateSchedule(m.schedule)}</span>
        </div>
        <div class="med-meta">
          <span class="med-meta-label">${t("durationLabel", "Duration")}</span>
          <span class="med-meta-value">${m.startDate} → ${m.endDate}</span>
        </div>
        <div class="med-meta">
          <span class="med-meta-label">Reason</span>
          <span class="med-meta-value" style="color:var(--ink)">${translateClinical(m.reason || "—")}</span>
        </div>
        <div class="med-meta">
          <span class="med-meta-label">${t("outcomeLabel", "Outcome")}</span>
          <span class="outcome-pill ${outcomeClass(m.outcome)}">${outcomeIcon(m.outcome)} ${translateOutcome(m.outcome)}</span>
        </div>
        ${m.effectNote ? `
        <div style="margin-top:10px;padding:12px;background:var(--blue-50);border-radius:10px;border-left:3px solid var(--blue-400);font-size:12px;color:var(--ink-muted);line-height:1.7;">
          <strong style="color:var(--ink);font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Patient Update · </strong>${translateClinical(m.effectNote)}
        </div>` : ""}
        ${m.followupDate ? `<div style="font-size:11px;color:var(--blue-500);font-weight:700;margin-top:8px;">🔄 Follow-up: ${m.followupDate}</div>` : ""}
        <div class="med-actions">
          ${canEdit ? `
            <button class="btn-sm-edit" onclick="openEditMedicine('${key}', '${m.id}')">${t("editBtn", "✏")}</button>
            <button class="btn-danger" onclick="deleteMedicine('${key}', '${m.id}')">${t("deleteBtn", "🗑")}</button>
          ` : `
            <button class="btn-sm-edit" onclick="openViewMedicine('${key}', '${m.id}')">${t("viewDetails", "👁 View")}</button>
          `}
        </div>
      </div>
    `}).join("");
  }

  // show/hide add button
  const addBtn = document.getElementById(`addMed${key}Btn`);
  if (addBtn) addBtn.classList.toggle("hidden", !canEdit);

  // Outcome summary — enhanced with visit history
  const totalVisits = doctorVisits.length;
  document.getElementById(`outcomeSummary${key}`).innerHTML = `
    <h3>📝 ${t("treatmentSummaryFor", "Treatment Summary")} — ${docName}</h3>
    ${totalVisits > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--blue-600);margin-bottom:10px;">Visits with ${docName}</div>
      ${doctorVisits.map((v, i) => `
        <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
          <span style="flex-shrink:0;font-size:11px;font-weight:800;background:var(--blue-600);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--ink)">📅 ${esc(v.date)} · ${translateClinical(v.title)}</div>
            <div style="font-size:12px;color:var(--ink-muted);line-height:1.6">${translateClinical(v.desc)}</div>
          </div>
          <span class="outcome-pill ${outcomeClass(v.outcome)}" style="flex-shrink:0;margin-left:auto">${outcomeIcon(v.outcome)} ${translateOutcome(v.outcome)}</span>
        </div>
      `).join("")}
    </div>
    ` : ""}
    ${d.meds.map(m => `
      <div style="margin-bottom:14px;padding:16px;background:var(--blue-50);border-radius:12px;border:1px solid var(--blue-100);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
          <strong style="color:var(--ink)">${m.name}</strong>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="background:var(--blue-600);color:#fff;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700">${esc(m.days || "—")}</span>
            <span class="outcome-pill ${outcomeClass(m.outcome)}">${outcomeIcon(m.outcome)} ${translateOutcome(m.outcome)}</span>
          </div>
        </div>
        <div style="font-size:13px;color:var(--ink-muted);line-height:1.6">${translateClinical(m.effectNote)}</div>
        ${m.followupDate ? `<div style="font-size:11px;color:var(--blue-500);margin-top:6px;font-weight:700;">${t("followupLabel", "Follow-up")}: ${m.followupDate}</div>` : ""}
      </div>
    `).join("")}
    <div class="outcome-note">
      ${t("outcomeDisclaimer", "ℹ Outcomes displayed are as documented in follow-up records. MED-TRACE does not claim the medicine caused the outcome.")}
    </div>
  `;
}


/* ─────────────────────────────────────────────
   HISTORY
───────────────────────────────────────────── */
function renderHistory() {
  const h = appData.history;
  const fields = [
    { key: "illness", i18nKey: "histIllness", label: "Past Illness / Chronic Conditions", icon: "🏥", cls: "illness" },
    { key: "surgery", i18nKey: "histSurgery", label: "Surgeries / Procedures", icon: "🔬", cls: "surgery" },
    { key: "accident", i18nKey: "histAccident", label: "Accidents / Trauma", icon: "🚑", cls: "accident" },
    { key: "allergy", i18nKey: "histAllergy", label: "Known Allergies", icon: "⚠️", cls: "allergy" },
    { key: "family", i18nKey: "histFamily", label: "Family Medical History", icon: "👨‍👩‍👧", cls: "family" },
    { key: "ongoing", i18nKey: "histOngoing", label: "Current / Ongoing Medicines", icon: "💊", cls: "ongoing" }
  ];

  document.getElementById("historyGrid").innerHTML = fields.map(f => {
    const rawVal = h[f.key];
    const displayVal = rawVal ? translateClinical(rawVal) : t("notDocumented", "Not documented");
    return `
      <div class="history-card ${f.cls}">
        <div class="history-card-icon">${f.icon}</div>
        <div class="history-card-label">${t(f.i18nKey, f.label)}</div>
        <div class="history-card-value ${rawVal ? "" : "history-card-empty"}">
          ${displayVal}
        </div>
      </div>
    `;
  }).join("");

  const editBtn = document.getElementById("editHistoryBtn");
  if (editBtn) editBtn.classList.toggle("hidden", !isDoctor());
}

/* ─────────────────────────────────────────────
   TIMELINE
───────────────────────────────────────────── */
function renderTimeline() {
  const items = appData.timeline;
  document.getElementById("timelineItems").innerHTML = items.length === 0
    ? `<p style='color:var(--ink-muted);font-size:14px'>${t("noTimelineYet", "No timeline entries yet.")}</p>`
    : items.map((tItem, idx) => {
      const doctorObj = tItem.doctor === "A" ? appData.doctors.A : appData.doctors.B;
      const doctorName = translateClinical(doctorObj.name);
      return `
        <div class="timeline-card" id="tl-${tItem.id}" style="display:flex;gap:16px;align-items:flex-start;">
          <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
            <div style="width:38px;height:38px;border-radius:50%;background:${tItem.doctor === 'A' ? 'var(--blue-600)' : 'var(--teal-500)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800">${idx + 1}</div>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
              <span style="font-size:12px;font-weight:700;color:var(--ink-muted)">📅 ${tItem.date}</span>
              <span style="font-size:11px;background:${tItem.doctor === 'A' ? 'var(--blue-100)' : '#d1faf0'};color:${tItem.doctor === 'A' ? 'var(--blue-700)' : 'var(--teal-700)'};border-radius:20px;padding:2px 10px;font-weight:700;">${doctorName}</span>
              <span class="outcome-pill ${outcomeClass(tItem.outcome)}">${outcomeIcon(tItem.outcome)} ${translateOutcome(tItem.outcome)}</span>
            </div>
            <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px;">${translateClinical(tItem.title)}</div>
            <div style="font-size:13px;color:var(--ink-muted);line-height:1.7;">${translateClinical(tItem.desc)}</div>
            ${isDoctor() ? `
              <div class="timeline-actions" style="margin-top:10px;">
                <button class="btn-sm-edit" onclick="openEditTimeline('${tItem.id}')">${t("editBtnText", "✏ Edit")}</button>
                <button class="btn-danger" onclick="deleteTimeline('${tItem.id}')">${t("deleteBtn", "🗑")}</button>
              </div>
            ` : ""}
          </div>
        </div>
        `;
    }).join("");

  const addBtn = document.getElementById("addTimelineBtn");
  if (addBtn) addBtn.classList.toggle("hidden", !isDoctor());
}

/* ─────────────────────────────────────────────
   REPORTS
───────────────────────────────────────────── */
function switchReportTab(key, btn) {
  document.querySelectorAll(".report-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  renderReport(key);
}

function renderReport(key) {
  const d = appData.doctors[key];
  const docName = translateClinical(d.name);
  const meds = d.meds;
  const doctorTimeline = appData.timeline.filter(ti => ti.doctor === key);
  const totalVisits = doctorTimeline.length;

  if (meds.length === 0) {
    document.getElementById("reportContent").innerHTML = `<div style="color:var(--ink-muted);padding:20px">No treatment records for this doctor.</div>`;
    return;
  }

  // Disease/condition treated
  const disease = meds[0] ? translateClinical(meds[0].reason) : "Not documented";

  // Narrative paragraph
  let narrative = `<p style="font-size:15px;line-height:1.9;color:var(--ink);margin-bottom:18px;">`;
  narrative += `The patient consulted <strong>${esc(docName)}</strong> (${esc(translateClinical(d.spec))}, ${esc(translateClinical(d.hospital))}) `;
  narrative += `with a documented clinical experience of <strong>${esc(translateClinical(d.experience))}</strong>. `;
  if (totalVisits > 0) {
    narrative += `A total of <strong>${totalVisits} visit${totalVisits > 1 ? "s" : ""}</strong> were recorded with this doctor. `;
  }
  narrative += `The primary reason for consultation was: <strong>${esc(disease)}</strong>.</p>`;

  // Per-visit section
  let visitsHTML = "";
  if (doctorTimeline.length > 0) {
    visitsHTML = `<div style="margin-bottom:22px;">
      <div class="report-section-heading">Visit-by-Visit Record</div>
      ${doctorTimeline.map((visit, i) => `
        <div style="background:var(--blue-50);border-radius:14px;border:1px solid var(--blue-100);padding:15px 18px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="background:var(--blue-600);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">${i + 1}</span>
            <span style="font-weight:700;color:var(--ink);font-size:13px">📅 ${esc(visit.date)}</span>
            <span class="outcome-pill ${outcomeClass(visit.outcome)}">${outcomeIcon(visit.outcome)} ${translateOutcome(visit.outcome)}</span>
          </div>
          <p style="font-size:13px;color:var(--ink);line-height:1.8;margin:0">${translateClinical(visit.desc)}</p>
        </div>
      `).join("")}
    </div>`;
  }

  // Medicine prescription cards
  const medsHTML = `<div style="margin-bottom:22px;">
    <div class="report-section-heading">Prescriptions & Outcomes</div>
    ${meds.map((m, i) => `
      <div style="background:#fff;border-radius:14px;border:1px solid var(--blue-100);padding:18px 20px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:15px;font-weight:800;color:var(--ink)">💊 ${esc(m.name)}</span>
            <span style="background:var(--blue-100);color:var(--blue-700);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">${esc(m.days || "—")}</span>
          </div>
          <span class="outcome-pill ${outcomeClass(m.outcome)}">${outcomeIcon(m.outcome)} ${translateOutcome(m.outcome)}</span>
        </div>
        <p style="font-size:13px;color:var(--ink);line-height:1.8;margin:0 0 10px 0;">
          ${translateClinical(m.effectNote || "No effect note documented.")}
        </p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--ink-muted);">
          <span>📅 Started: <strong>${esc(m.startDate)}</strong></span>
          <span>⏱ Until: <strong>${esc(m.endDate)}</strong></span>
          ${m.followupDate ? `<span>🔄 Follow-up: <strong>${esc(m.followupDate)}</strong></span>` : ""}
          <span>⏰ ${esc(m.schedule || "—")}</span>
        </div>
      </div>
    `).join("")}
  </div>`;

  // Summary paragraph
  const lastMed = meds[meds.length - 1];
  let summaryPara = `<p style="font-size:14px;line-height:1.9;color:var(--ink);margin:0;">`;
  summaryPara += `Overall, treatment under ${esc(docName)} concluded with a net outcome of `;
  summaryPara += `<strong>${translateOutcome(d.netOutcome)}</strong>. `;
  if (lastMed) {
    summaryPara += `The final documented medicine was <strong>${esc(lastMed.name)}</strong> (${esc(lastMed.days || "ongoing")}), `;
    summaryPara += lastMed.endDate && lastMed.endDate.toLowerCase() !== "ongoing"
      ? `ending on <strong>${esc(lastMed.endDate)}</strong>. `
      : `which is <strong>ongoing</strong>. `;
    if (lastMed.followupDate) summaryPara += `Final follow-up was documented on <strong>${esc(lastMed.followupDate)}</strong>.`;
  }
  summaryPara += `</p>`;

  document.getElementById("reportContent").innerHTML = `
    <div style="padding:4px 0;">
      <div class="report-section-heading">Treatment Overview</div>
      ${narrative}
      ${visitsHTML}
      ${medsHTML}
      <div class="report-section-heading">Summary</div>
      <div style="background:var(--blue-50);border-radius:12px;border:1px solid var(--blue-100);padding:16px 20px;">
        ${summaryPara}
      </div>
    </div>
  `;
}


/* ─────────────────────────────────────────────
   PROFILE
───────────────────────────────────────────── */
function renderProfile() {
  const p = appData.patient;
  const patientName = translateClinical(p.name);
  const totalMeds = appData.doctors.A.meds.length + appData.doctors.B.meds.length;
  const genderVal = p.gender === "Male" ? t("genderMale", "Male") : p.gender === "Female" ? t("genderFemale", "Female") : p.gender;
  const ageVal = `${p.age} ${t("years", "years")}`;

  document.getElementById("profileContent").innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${p.name[0]}</div>
      <div class="profile-name">${patientName}</div>
      <div class="profile-id">${p.id}</div>
      <div class="profile-stats">
        <div class="profile-stat-item">
          <div class="profile-stat-val">${p.age}</div>
          <div class="profile-stat-lbl">${t("statAge", "Age")}</div>
        </div>
        <div class="profile-stat-item">
          <div class="profile-stat-val">${p.blood}</div>
          <div class="profile-stat-lbl">${t("statBlood", "Blood")}</div>
        </div>
        <div class="profile-stat-item">
          <div class="profile-stat-val">${totalMeds}</div>
          <div class="profile-stat-lbl">${t("statMedicines", "Medicines")}</div>
        </div>
      </div>
    </div>
    <div class="profile-details">
      <h3>${t("personalInfo", "Personal Information")}</h3>
      ${[
      { label: t("fullNameLabel", "Full Name"), value: patientName },
      { label: t("ageLabel", "Age"), value: ageVal },
      { label: t("genderLabel", "Gender"), value: genderVal },
      { label: t("bloodGroupLabel", "Blood Group"), value: p.blood },
      { label: t("phoneLabel", "Phone"), value: p.phone },
      { label: t("emailLabel", "Email"), value: p.email },
      { label: t("addressLabel", "Address"), value: p.address },
      { label: t("emergencyContactLabel", "Emergency Contact"), value: p.emergencyContact }
    ].map(f => `
        <div class="profile-field">
          <span class="profile-field-label">${f.label}</span>
          <span class="profile-field-value">${f.value || "—"}</span>
        </div>
      `).join("")}
    </div>
  `;

  const editBtn = document.getElementById("editProfileBtn");
  if (editBtn) editBtn.classList.toggle("hidden", !isDoctor());
}

/* ─────────────────────────────────────────────
   MODALS — ADD / EDIT MEDICINE
───────────────────────────────────────────── */
function openAddMedicine(key) {
  openModal(`➕ Add Medicine — Doctor ${key}`, `
    <div class="modal-section-title">Medicine Details</div>
    <div class="form-group">
      <label>Medicine Name *</label>
      <input id="mf_name" placeholder="e.g. Metformin 500mg">
    </div>
    <div class="form-group">
      <label>Dosage</label>
      <input id="mf_dosage" placeholder="e.g. 500mg twice daily">
    </div>
    <div class="form-group">
      <label>Duration</label>
      <input id="mf_days" placeholder="e.g. 30 days">
    </div>
    <div class="form-group">
      <label>Schedule</label>
      <input id="mf_schedule" placeholder="e.g. Morning · 8:00 AM">
    </div>
    <div class="form-group">
      <label>Start Date</label>
      <input id="mf_startDate" placeholder="e.g. 01 Jan 2025">
    </div>
    <div class="form-group">
      <label>End Date</label>
      <input id="mf_endDate" placeholder="e.g. 31 Jan 2025 or Ongoing">
    </div>
    <div class="form-group">
      <label>Reason / Purpose</label>
      <textarea id="mf_reason" placeholder="Why was this medicine prescribed?"></textarea>
    </div>
    <div class="modal-section-title" style="margin-top:8px">Outcome (After Follow-up)</div>
    <div class="form-group">
      <label>Outcome</label>
      <select id="mf_outcome">
        <option value="Improved">✅ Improved</option>
        <option value="Worsened">❌ Worsened</option>
        <option value="No Change">➖ No Change</option>
        <option value="Mixed">⚡ Mixed</option>
      </select>
    </div>
    <div class="form-group">
      <label>Effect Notes (what happened after)</label>
      <textarea id="mf_effectNote" placeholder="Describe the effect and patient response..."></textarea>
    </div>
    <div class="form-group">
      <label>Follow-up Date</label>
      <input id="mf_followupDate" placeholder="e.g. 15 Jan 2025">
    </div>
    <button class="btn-save" onclick="saveMedicine('${key}', null)">💾 Save Medicine</button>
  `);
}

function openEditMedicine(key, id) {
  const med = appData.doctors[key].meds.find(m => m.id === id);
  if (!med) return;

  openModal(`✏ Edit Medicine — ${med.name}`, `
    <div class="modal-section-title">Medicine Details</div>
    <div class="form-group">
      <label>Medicine Name *</label>
      <input id="mf_name" value="${esc(med.name)}">
    </div>
    <div class="form-group">
      <label>Dosage</label>
      <input id="mf_dosage" value="${esc(med.dosage)}">
    </div>
    <div class="form-group">
      <label>Duration</label>
      <input id="mf_days" value="${esc(med.days)}">
    </div>
    <div class="form-group">
      <label>Schedule</label>
      <input id="mf_schedule" value="${esc(med.schedule)}">
    </div>
    <div class="form-group">
      <label>Start Date</label>
      <input id="mf_startDate" value="${esc(med.startDate)}">
    </div>
    <div class="form-group">
      <label>End Date</label>
      <input id="mf_endDate" value="${esc(med.endDate)}">
    </div>
    <div class="form-group">
      <label>Reason / Purpose</label>
      <textarea id="mf_reason">${esc(med.reason)}</textarea>
    </div>
    <div class="modal-section-title" style="margin-top:8px">Outcome (After Follow-up)</div>
    <div class="form-group">
      <label>Outcome</label>
      <select id="mf_outcome">
        ${["Improved", "Worsened", "No Change", "Mixed"].map(o =>
    `<option value="${o}" ${med.outcome === o ? "selected" : ""}>${o}</option>`
  ).join("")}
      </select>
    </div>
    <div class="form-group">
      <label>Effect Notes</label>
      <textarea id="mf_effectNote">${esc(med.effectNote)}</textarea>
    </div>
    <div class="form-group">
      <label>Follow-up Date</label>
      <input id="mf_followupDate" value="${esc(med.followupDate)}">
    </div>
    <button class="btn-save" onclick="saveMedicine('${key}', '${id}')">💾 Update Medicine</button>
  `);
}

function openViewMedicine(key, id) {
  const med = appData.doctors[key].meds.find(m => m.id === id);
  if (!med) return;

  openModal(`💊 ${med.name}`, `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="report-row"><span class="report-row-label">${t("medLabel", "Medicine")}</span><span class="report-row-value">${med.name}</span></div>
      <div class="report-row"><span class="report-row-label">${t("dosageLabel", "Dosage")}</span><span class="report-row-value">${translateSchedule(med.dosage)}</span></div>
      <div class="report-row"><span class="report-row-label">${t("durationLabel", "Duration")}</span><span class="report-row-value">${translateSchedule(med.days)}</span></div>
      <div class="report-row"><span class="report-row-label">${t("scheduleLabel", "Schedule")}</span><span class="report-row-value">${translateSchedule(med.schedule)}</span></div>
      <div class="report-row"><span class="report-row-label">${t("startDateLabel", "Start Date")}</span><span class="report-row-value">${med.startDate}</span></div>
      <div class="report-row"><span class="report-row-label">${t("endDateLabel", "End Date")}</span><span class="report-row-value">${med.endDate}</span></div>
      <div class="report-row"><span class="report-row-label">${t("reasonVisitLabel", "Reason")}</span><span class="report-row-value">${translateClinical(med.reason)}</span></div>
      <div class="report-row"><span class="report-row-label">${t("outcomeLabel", "Outcome")}</span>
        <span class="outcome-pill ${outcomeClass(med.outcome)}">${outcomeIcon(med.outcome)} ${translateOutcome(med.outcome)}</span>
      </div>
      <div style="padding:14px;background:var(--blue-50);border-radius:10px;border-left:3px solid var(--blue-400);font-size:13px;color:var(--ink-muted)">
        ${translateClinical(med.effectNote)}
      </div>
      ${med.followupDate ? `<div style="font-size:12px;color:var(--blue-500);font-weight:700">${t("followupLabel", "Follow-up")}: ${med.followupDate}</div>` : ""}
    </div>
  `);
}

function saveMedicine(key, existingId) {
  const name = document.getElementById("mf_name").value.trim();
  if (!name) { showToast("Medicine name is required.", "error"); return; }

  const med = {
    id: existingId || "m" + Date.now(),
    name,
    dosage: document.getElementById("mf_dosage").value.trim(),
    days: document.getElementById("mf_days").value.trim(),
    schedule: document.getElementById("mf_schedule").value.trim(),
    startDate: document.getElementById("mf_startDate").value.trim(),
    endDate: document.getElementById("mf_endDate").value.trim(),
    reason: document.getElementById("mf_reason").value.trim(),
    outcome: document.getElementById("mf_outcome").value,
    effectNote: document.getElementById("mf_effectNote").value.trim(),
    followupDate: document.getElementById("mf_followupDate").value.trim()
  };

  if (existingId) {
    const idx = appData.doctors[key].meds.findIndex(m => m.id === existingId);
    if (idx !== -1) appData.doctors[key].meds[idx] = med;
  } else {
    appData.doctors[key].meds.push(med);
  }

  // Update net outcome automatically
  updateNetOutcome(key);
  saveData();
  syncMedicineToBackend(med, key);
  closeModal();
  renderDoctorSection(key);
  renderNavBadges();
  renderAll();
  showToast(existingId ? "✅ Medicine updated!" : "✅ Medicine added!", "success");
}

function updateNetOutcome(key) {
  const meds = appData.doctors[key].meds;
  if (meds.length === 0) { appData.doctors[key].netOutcome = "No Data"; return; }
  const improved = meds.filter(m => m.outcome === "Improved").length;
  const worsened = meds.filter(m => m.outcome === "Worsened").length;
  if (improved > worsened) appData.doctors[key].netOutcome = "Improved";
  else if (worsened > improved) appData.doctors[key].netOutcome = "Worsened";
  else if (improved === 0 && worsened === 0) appData.doctors[key].netOutcome = "No Change";
  else appData.doctors[key].netOutcome = "Mixed";
}

function deleteMedicine(key, id) {
  if (!confirm("Delete this medicine entry?")) return;
  appData.doctors[key].meds = appData.doctors[key].meds.filter(m => m.id !== id);
  updateNetOutcome(key);
  saveData();
  renderDoctorSection(key);
  renderNavBadges();
  renderAll();
  showToast("🗑 Medicine deleted.", "success");
}

/* ─────────────────────────────────────────────
   MODALS — EDIT DOCTOR INFO
───────────────────────────────────────────── */
function openEditDoctorInfo(key) {
  const d = appData.doctors[key];
  openModal(`✏ Edit Doctor ${key} Info`, `
    <div class="form-group">
      <label>Full Name</label>
      <input id="df_name" value="${esc(d.name)}">
    </div>
    <div class="form-group">
      <label>Specialization</label>
      <input id="df_spec" value="${esc(d.spec)}">
    </div>
    <div class="form-group">
      <label>Hospital / Clinic</label>
      <input id="df_hospital" value="${esc(d.hospital)}">
    </div>
    <div class="form-group">
      <label>Years of Experience</label>
      <input id="df_exp" value="${esc(d.experience)}">
    </div>
    <button class="btn-save" onclick="saveDoctorInfo('${key}')">💾 Save Doctor Info</button>
  `);
}

function saveDoctorInfo(key) {
  appData.doctors[key].name = document.getElementById("df_name").value.trim();
  appData.doctors[key].spec = document.getElementById("df_spec").value.trim();
  appData.doctors[key].hospital = document.getElementById("df_hospital").value.trim();
  appData.doctors[key].experience = document.getElementById("df_exp").value.trim();
  saveData();
  closeModal();
  renderDoctorSection(key);
  renderTopbar();
  showToast("✅ Doctor info updated!", "success");
}

/* ─────────────────────────────────────────────
   MODALS — EDIT HISTORY
───────────────────────────────────────────── */
function openEditHistory() {
  const h = appData.history;
  openModal("✏ Edit Patient History", `
    <div class="modal-section-title">Medical Background</div>
    <div class="form-group">
      <label>Past Illness / Chronic Conditions</label>
      <textarea id="hf_illness">${esc(h.illness)}</textarea>
    </div>
    <div class="form-group">
      <label>Surgeries / Procedures</label>
      <textarea id="hf_surgery">${esc(h.surgery)}</textarea>
    </div>
    <div class="form-group">
      <label>Accidents / Trauma</label>
      <textarea id="hf_accident">${esc(h.accident)}</textarea>
    </div>
    <div class="form-group">
      <label>Known Allergies</label>
      <textarea id="hf_allergy">${esc(h.allergy)}</textarea>
    </div>
    <div class="form-group">
      <label>Family Medical History</label>
      <textarea id="hf_family">${esc(h.family)}</textarea>
    </div>
    <div class="form-group">
      <label>Current / Ongoing Medicines</label>
      <textarea id="hf_ongoing">${esc(h.ongoing)}</textarea>
    </div>
    <button class="btn-save" onclick="saveHistory()">💾 Save History</button>
  `);
}

function saveHistory() {
  appData.history.illness = document.getElementById("hf_illness").value.trim();
  appData.history.surgery = document.getElementById("hf_surgery").value.trim();
  appData.history.accident = document.getElementById("hf_accident").value.trim();
  appData.history.allergy = document.getElementById("hf_allergy").value.trim();
  appData.history.family = document.getElementById("hf_family").value.trim();
  appData.history.ongoing = document.getElementById("hf_ongoing").value.trim();
  saveData();
  closeModal();
  renderHistory();
  renderDashboard();
  showToast("✅ Patient history updated!", "success");
}

/* ─────────────────────────────────────────────
   MODALS — EDIT PROFILE
───────────────────────────────────────────── */
function openEditProfile() {
  const p = appData.patient;
  openModal("✏ Edit Patient Profile", `
    <div class="modal-section-title">Personal Details</div>
    <div class="form-group">
      <label>Full Name</label>
      <input id="pf_name" value="${esc(p.name)}">
    </div>
    <div class="form-group">
      <label>Age</label>
      <input id="pf_age" type="number" value="${p.age}">
    </div>
    <div class="form-group">
      <label>Gender</label>
      <select id="pf_gender">
        ${["Male", "Female", "Other"].map(g =>
    `<option value="${g}" ${p.gender === g ? "selected" : ""}>${g}</option>`
  ).join("")}
      </select>
    </div>
    <div class="form-group">
      <label>Blood Group</label>
      <select id="pf_blood">
        ${["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(b =>
    `<option value="${b}" ${p.blood === b ? "selected" : ""}>${b}</option>`
  ).join("")}
      </select>
    </div>
    <div class="form-group">
      <label>Phone Number</label>
      <input id="pf_phone" value="${esc(p.phone)}">
    </div>
    <div class="form-group">
      <label>Email</label>
      <input id="pf_email" type="email" value="${esc(p.email)}">
    </div>
    <div class="form-group">
      <label>Address</label>
      <textarea id="pf_address">${esc(p.address)}</textarea>
    </div>
    <div class="form-group">
      <label>Emergency Contact</label>
      <input id="pf_emergency" value="${esc(p.emergencyContact)}">
    </div>
    <button class="btn-save" onclick="saveProfile()">💾 Save Profile</button>
  `);
}

function saveProfile() {
  appData.patient.name = document.getElementById("pf_name").value.trim();
  appData.patient.age = document.getElementById("pf_age").value;
  appData.patient.gender = document.getElementById("pf_gender").value;
  appData.patient.blood = document.getElementById("pf_blood").value;
  appData.patient.phone = document.getElementById("pf_phone").value.trim();
  appData.patient.email = document.getElementById("pf_email").value.trim();
  appData.patient.address = document.getElementById("pf_address").value.trim();
  appData.patient.emergencyContact = document.getElementById("pf_emergency").value.trim();
  saveData();
  closeModal();
  renderProfile();
  renderTopbar();
  showToast("✅ Profile updated!", "success");
}

/* ─────────────────────────────────────────────
   MODALS — TIMELINE
───────────────────────────────────────────── */
function openAddTimeline() {
  openModal("📅 Add Timeline Entry", `
    <div class="form-group">
      <label>Date</label>
      <input id="tf_date" placeholder="e.g. 01 Sep 2024">
    </div>
    <div class="form-group">
      <label>Title</label>
      <input id="tf_title" placeholder="e.g. Follow-up — Doctor A">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="tf_desc" placeholder="What happened during this visit?"></textarea>
    </div>
    <div class="form-group">
      <label>Doctor</label>
      <select id="tf_doctor">
        <option value="A">Doctor A</option>
        <option value="B">Doctor B</option>
      </select>
    </div>
    <div class="form-group">
      <label>Outcome</label>
      <select id="tf_outcome">
        <option value="Improved">Improved</option>
        <option value="Worsened">Worsened</option>
        <option value="No Change">No Change</option>
        <option value="Mixed">Mixed</option>
      </select>
    </div>
    <button class="btn-save" onclick="saveTimeline(null)">💾 Add Entry</button>
  `);
}

function openEditTimeline(id) {
  const t = appData.timeline.find(x => x.id === id);
  if (!t) return;
  openModal("✏ Edit Timeline Entry", `
    <div class="form-group">
      <label>Date</label>
      <input id="tf_date" value="${esc(t.date)}">
    </div>
    <div class="form-group">
      <label>Title</label>
      <input id="tf_title" value="${esc(t.title)}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="tf_desc">${esc(t.desc)}</textarea>
    </div>
    <div class="form-group">
      <label>Doctor</label>
      <select id="tf_doctor">
        <option value="A" ${t.doctor === "A" ? "selected" : ""}>Doctor A</option>
        <option value="B" ${t.doctor === "B" ? "selected" : ""}>Doctor B</option>
      </select>
    </div>
    <div class="form-group">
      <label>Outcome</label>
      <select id="tf_outcome">
        ${["Improved", "Worsened", "No Change", "Mixed"].map(o =>
    `<option value="${o}" ${t.outcome === o ? "selected" : ""}>${o}</option>`
  ).join("")}
      </select>
    </div>
    <button class="btn-save" onclick="saveTimeline('${id}')">💾 Update Entry</button>
  `);
}

function saveTimeline(existingId) {
  const title = document.getElementById("tf_title").value.trim();
  if (!title) { showToast("Title is required.", "error"); return; }

  const entry = {
    id: existingId || "t" + Date.now(),
    date: document.getElementById("tf_date").value.trim(),
    title,
    desc: document.getElementById("tf_desc").value.trim(),
    doctor: document.getElementById("tf_doctor").value,
    outcome: document.getElementById("tf_outcome").value
  };

  if (existingId) {
    const idx = appData.timeline.findIndex(x => x.id === existingId);
    if (idx !== -1) appData.timeline[idx] = entry;
  } else {
    appData.timeline.push(entry);
  }

  saveData();
  closeModal();
  renderTimeline();
  renderRecentActivity();
  renderStatsGrid();
  showToast(existingId ? "✅ Entry updated!" : "✅ Entry added!", "success");
}

function deleteTimeline(id) {
  if (!confirm("Delete this timeline entry?")) return;
  appData.timeline = appData.timeline.filter(t => t.id !== id);
  saveData();
  renderTimeline();
  renderStatsGrid();
  showToast("🗑 Entry deleted.", "success");
}

/* ─────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────── */
function openModal(title, body) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = body;
  document.getElementById("modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.body.style.overflow = "";
  const mc = document.getElementById("modalCard");
  if (mc) mc.classList.remove("lightbox-modal");
}

function closeModalOnOverlay(e) {
  if (e.target === document.getElementById("modal")) closeModal();
}

/* ═══════════════════════════════════════════════════════════
   MEDICAL RECORDS & SCANS (PIC UPLOAD & VIEWER)
═══════════════════════════════════════════════════════════ */
var DOC_CATEGORIES = {
  xray: { icon: "🩻", labelKey: "filterXray", defaultLabel: "X-Ray", badgeCls: "cat-badge-xray" },
  blood: { icon: "🩸", labelKey: "filterBlood", defaultLabel: "Blood Report", badgeCls: "cat-badge-blood" },
  mri: { icon: "🧠", labelKey: "filterMri", defaultLabel: "MRI / CT Scan", badgeCls: "cat-badge-mri" },
  prescription: { icon: "📄", labelKey: "filterPrescription", defaultLabel: "Prescription", badgeCls: "cat-badge-prescription" },
  other: { icon: "📋", labelKey: "filterOther", defaultLabel: "Medical Document", badgeCls: "cat-badge-other" }
};

var currentDocFilter = "all";
var pendingDocUpload = null;

function filterRecords(category, btn) {
  currentDocFilter = category;
  document.querySelectorAll(".record-filter-tab").forEach(t => t.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderRecords(category);
}

function renderRecordsBadge() {
  const badge = document.getElementById("badgeRecords");
  if (!badge) return;
  const count = (appData.documents || []).length;
  badge.textContent = count > 0 ? count : "";
}

function renderRecords(filter = currentDocFilter) {
  const grid = document.getElementById("recordsGrid");
  if (!grid) return;

  const docs = appData.documents || [];
  const filtered = filter === "all" ? docs : docs.filter(d => d.category === filter);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="records-empty" style="grid-column: 1 / -1">
        <div class="records-empty-icon">📁</div>
        <div class="records-empty-title">${t("noDocsTitle", "No medical reports or scans uploaded yet")}</div>
        <div class="records-empty-sub">${t("noDocsSub", "Upload your X-ray pictures, blood test results, MRI scans, or doctor prescriptions directly from your phone or computer.")}</div>
        <button class="btn-primary" onclick="openUploadDocModal('${filter !== 'all' ? filter : 'xray'}')">
          <span>📷</span> ${t("btnUploadFirst", "+ Upload Your First Document")}
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(doc => {
    const catInfo = DOC_CATEGORIES[doc.category] || DOC_CATEGORIES.other;
    const catLabel = t(catInfo.labelKey, catInfo.defaultLabel);
    const isImage = doc.fileData && (doc.fileData.startsWith("data:image") || doc.fileData.endsWith(".jpg") || doc.fileData.endsWith(".png"));

    return `
      <div class="record-card">
        <div class="record-card-img-wrap" onclick="openDocViewer('${doc.id}')">
          <span class="record-card-cat-badge ${catInfo.badgeCls}">${catInfo.icon} ${catLabel}</span>
          ${isImage
        ? `<img src="${doc.fileData}" class="record-card-img" alt="${esc(doc.title)}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'180\\' viewBox=\\'0 0 300 180\\'><rect fill=\\'%230f172a\\' width=\\'300\\' height=\\'180\\'/><text fill=\\'%2394a3b8\\' font-size=\\'16\\' x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\'>Medical Scan</text></svg>'">`
        : `<div class="record-card-pdf-icon">📄<span style="font-size:12px;color:#cbd5e1">${esc(doc.fileName || "Document")}</span></div>`
      }
        </div>
        <div class="record-card-body">
          <div class="record-card-title">${esc(doc.title)}</div>
          <div class="record-card-meta">
            <span>📅 ${esc(doc.date)}</span>
            <span>·</span>
            <span>🏥 ${esc(doc.doctorOrLab || "Self")}</span>
          </div>
          ${doc.notes ? `<div class="record-card-notes">${esc(doc.notes)}</div>` : `<div class="record-card-notes" style="color:var(--ink-muted);font-style:italic">No clinical notes recorded.</div>`}
          <div class="record-card-footer">
            <span class="record-file-chip">${esc(doc.fileSize || "File")}</span>
            <div class="record-actions">
              <button class="btn-record-action" onclick="openDocViewer('${doc.id}')" title="${t("btnViewFull", "View Full")}">
                👁️ ${t("btnViewFull", "View")}
              </button>
              <button class="btn-record-action" onclick="downloadDoc('${doc.id}')" title="${t("btnDownload", "Download")}">
                ⬇
              </button>
              <button class="btn-record-action delete" onclick="deleteDoc('${doc.id}')" title="${t("btnDeleteDoc", "Delete")}">
                🗑
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function openUploadDocModal(defaultCategory) {
  pendingDocUpload = null;
  const today = new Date().toISOString().split("T")[0];
  const cat = defaultCategory || "xray";

  openModal(t("modalUploadTitle", "📷 Upload Medical Report / Scan"), `
    <div class="dropzone-area" id="up_dropzone" onclick="document.getElementById('up_fileInput').click()" ondragover="handleDocDragOver(event)" ondragleave="handleDocDragLeave(event)" ondrop="handleDocDrop(event)">
      <input type="file" id="up_fileInput" accept="image/*,application/pdf" style="display:none" onchange="handleDocFileSelect(event)">
      <div class="dropzone-icon">📁</div>
      <div class="dropzone-title">${t("dropzoneTitle", "Click to browse or drag & drop photo/report")}</div>
      <div class="dropzone-sub">${t("dropzoneSub", "Supports JPG, PNG, WEBP, PDF (Max 15MB)")}</div>
    </div>

    <div id="up_previewWrap" style="display:none"></div>

    <div class="form-group">
      <label>${t("docCategoryLabel", "Document Category")}</label>
      <select id="up_category" class="form-select">
        <option value="xray" ${cat === "xray" ? "selected" : ""}>🩻 ${t("filterXray", "X-Ray")}</option>
        <option value="blood" ${cat === "blood" ? "selected" : ""}>🩸 ${t("filterBlood", "Blood Report")}</option>
        <option value="mri" ${cat === "mri" ? "selected" : ""}>🧠 ${t("filterMri", "MRI / CT Scan")}</option>
        <option value="prescription" ${cat === "prescription" ? "selected" : ""}>📄 ${t("filterPrescription", "Doctor Prescription")}</option>
        <option value="other" ${cat === "other" ? "selected" : ""}>📋 ${t("filterOther", "Other Medical Document")}</option>
      </select>
    </div>

    <div class="form-group">
      <label>${t("docTitleLabel", "Report / Test Title")}</label>
      <input id="up_title" placeholder="${t("docTitlePh", "e.g. Chest X-Ray (PA View), Complete Blood Count")}">
    </div>

    <div class="grid-2">
      <div class="form-group">
        <label>${t("docLabLabel", "Lab / Hospital / Doctor")}</label>
        <input id="up_doctorOrLab" placeholder="${t("docLabPh", "e.g. Apollo Hospital, SRL Diagnostics")}">
      </div>
      <div class="form-group">
        <label>${t("docDateLabel", "Report / Test Date")}</label>
        <input id="up_date" type="date" value="${today}">
      </div>
    </div>

    <div class="form-group">
      <label>${t("docNotesLabel", "Clinical Notes / Key Findings")}</label>
      <textarea id="up_notes" rows="3" placeholder="${t("docNotesPh", "e.g. Clear lung fields, Hemoglobin 14.2 g/dL, normal platelet count...")}"></textarea>
    </div>

    <div style="display:flex;gap:12px;margin-top:20px">
      <button class="btn-save" style="flex:1" onclick="saveUploadedDoc()">${t("btnSaveDoc", "💾 Save & Upload Document")}</button>
      <button class="btn-cancel" onclick="closeModal()">${t("cancel", "Cancel")}</button>
    </div>
  `);
}

function handleDocFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  processSelectedDocFile(file);
}

function handleDocDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const dz = document.getElementById("up_dropzone");
  if (dz) dz.classList.remove("dragover");
  if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    processSelectedDocFile(event.dataTransfer.files[0]);
  }
}

function handleDocDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const dz = document.getElementById("up_dropzone");
  if (dz) dz.classList.add("dragover");
}

function handleDocDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const dz = document.getElementById("up_dropzone");
  if (dz) dz.classList.remove("dragover");
}

function processSelectedDocFile(file) {
  if (file.size > 15 * 1024 * 1024) {
    showToast("File is too large. Please select a file under 15MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    pendingDocUpload = {
      fileData: dataUrl,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      fileType: file.type || "image/jpeg"
    };

    const titleInput = document.getElementById("up_title");
    if (titleInput && !titleInput.value.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }

    const previewWrap = document.getElementById("up_previewWrap");
    if (previewWrap) {
      previewWrap.style.display = "block";
      const isImg = file.type.startsWith("image/");
      previewWrap.innerHTML = `
        <div class="preview-container">
          ${isImg
          ? `<img src="${dataUrl}" class="preview-img" alt="Document Preview">`
          : `<div class="record-card-pdf-icon">📄<span style="font-size:14px;color:#fff">${esc(file.name)}</span></div>`
        }
          <button type="button" class="preview-remove-btn" onclick="removePendingDoc()">✕ Remove</button>
        </div>
        <div style="font-size:12px;color:var(--ink-muted);margin-bottom:14px;text-align:center">
          📎 <strong>${esc(file.name)}</strong> (${formatFileSize(file.size)})
        </div>
      `;
    }

    const dz = document.getElementById("up_dropzone");
    if (dz) {
      dz.style.padding = "12px 16px";
      dz.innerHTML = `<span style="font-size:13px;color:var(--blue-600);font-weight:600">✓ File selected: ${esc(file.name)}. Click to change file.</span>
        <input type="file" id="up_fileInput" accept="image/*,application/pdf" style="display:none" onchange="handleDocFileSelect(event)">`;
    }
  };
  reader.readAsDataURL(file);
}

function removePendingDoc() {
  pendingDocUpload = null;
  const previewWrap = document.getElementById("up_previewWrap");
  if (previewWrap) {
    previewWrap.innerHTML = "";
    previewWrap.style.display = "none";
  }
  const dz = document.getElementById("up_dropzone");
  if (dz) {
    dz.style.padding = "";
    dz.innerHTML = `
      <input type="file" id="up_fileInput" accept="image/*,application/pdf" style="display:none" onchange="handleDocFileSelect(event)">
      <div class="dropzone-icon">📁</div>
      <div class="dropzone-title">${t("dropzoneTitle", "Click to browse or drag & drop photo/report")}</div>
      <div class="dropzone-sub">${t("dropzoneSub", "Supports JPG, PNG, WEBP, PDF (Max 15MB)")}</div>
    `;
  }
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return "File";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function createDocPlaceholderSVG(category, title) {
  const cat = DOC_CATEGORIES[category] || DOC_CATEGORIES.other;
  const icon = cat.icon || "📄";
  const label = t(cat.labelKey, cat.defaultLabel);
  const color1 = category === "xray" ? "#1e3a8a" : category === "blood" ? "#991b1b" : category === "mri" ? "#581c87" : category === "prescription" ? "#92400e" : "#065f46";
  const color2 = category === "xray" ? "#0f172a" : category === "blood" ? "#450a0a" : category === "mri" ? "#2e1065" : category === "prescription" ? "#451a03" : "#022c22";

  const cleanTitle = (title || "Medical Document").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}"/>
        <stop offset="100%" stop-color="${color2}"/>
      </linearGradient>
    </defs>
    <rect width="600" height="360" fill="url(#bg)"/>
    <circle cx="300" cy="130" r="55" fill="rgba(255,255,255,0.12)"/>
    <text x="300" y="145" font-family="sans-serif" font-size="48" text-anchor="middle" dominant-baseline="middle">${icon}</text>
    <text x="300" y="230" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${cleanTitle}</text>
    <text x="300" y="265" font-family="sans-serif" font-size="14" fill="rgba(255,255,255,0.8)" text-anchor="middle">${label}</text>
    <rect x="230" y="295" width="140" height="24" rx="12" fill="rgba(255,255,255,0.18)"/>
    <text x="300" y="311" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">MED-TRACE SCAN</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function saveUploadedDoc() {
  const title = (document.getElementById("up_title") ? document.getElementById("up_title").value.trim() : "") || (pendingDocUpload ? pendingDocUpload.fileName : "");
  if (!title && !pendingDocUpload) {
    showToast(t("toastTitleOrFileRequired", "Please select a photo or enter a report title."), "error");
    return;
  }

  const category = (document.getElementById("up_category") ? document.getElementById("up_category").value : "other") || "other";
  const doctorOrLab = document.getElementById("up_doctorOrLab") ? document.getElementById("up_doctorOrLab").value.trim() : "";
  const date = (document.getElementById("up_date") ? document.getElementById("up_date").value : "") || new Date().toISOString().split("T")[0];
  const notes = document.getElementById("up_notes") ? document.getElementById("up_notes").value.trim() : "";

  let fileData = "";
  let fileName = "";
  let fileSize = "1.2 MB";
  let fileType = "image/png";

  if (pendingDocUpload) {
    fileData = pendingDocUpload.fileData;
    fileName = pendingDocUpload.fileName;
    fileSize = pendingDocUpload.fileSize;
    fileType = pendingDocUpload.fileType;
  } else {
    fileName = (title || "report").toLowerCase().replace(/\s+/g, "_") + ".png";
    fileData = createDocPlaceholderSVG(category, title);
  }

  const newDoc = {
    id: "doc_" + Date.now(),
    title: title || t("docDefaultTitle", "Medical Document"),
    category: category,
    date: date,
    doctorOrLab: doctorOrLab || "Self Upload",
    notes: notes,
    fileData: fileData,
    fileName: fileName,
    fileSize: fileSize,
    fileType: fileType,
    uploadedBy: session.role === "patient" ? (appData.patient.name || "Patient") : (session.role === "doctorA" ? appData.doctors.A.name : appData.doctors.B.name),
    uploadedAt: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  };

  if (!appData.documents) appData.documents = [];
  appData.documents.unshift(newDoc);
  saveData();
  closeModal();

  renderRecords();
  renderRecordsBadge();
  renderStatsGrid();

  showToast(t("docUploadedSuccess", "✅ Medical document uploaded successfully!"), "success");
  showSection("records", document.getElementById("nav-records"));
}

function openDocViewer(id) {
  const doc = (appData.documents || []).find(d => d.id === id);
  if (!doc) return;

  const catInfo = DOC_CATEGORIES[doc.category] || DOC_CATEGORIES.other;
  const catLabel = t(catInfo.labelKey, catInfo.defaultLabel);
  const isImage = doc.fileData && (doc.fileData.startsWith("data:image") || doc.fileData.endsWith(".jpg") || doc.fileData.endsWith(".png"));

  const modalHtml = `
    <div class="lightbox-img-wrap">
      ${isImage
      ? `<img src="${doc.fileData}" class="lightbox-img" alt="${esc(doc.title)}">`
      : `<div class="record-card-pdf-icon" style="font-size:60px">📄<div style="font-size:16px;margin-top:10px">${esc(doc.fileName)}</div></div>`
    }
    </div>
    <div class="lightbox-details">
      <div class="lightbox-title-row">
        <div>
          <span class="record-card-cat-badge ${catInfo.badgeCls}" style="position:static;margin-bottom:8px;display:inline-block">${catInfo.icon} ${catLabel}</span>
          <h3 style="font-size:18px;font-weight:800;color:var(--ink)">${esc(doc.title)}</h3>
        </div>
        <div style="font-size:12px;color:var(--ink-muted);text-align:right">
          <div><strong>Date:</strong> ${esc(doc.date)}</div>
          <div><strong>Uploaded by:</strong> ${esc(doc.uploadedBy || "Patient")}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;font-size:13px;border-top:1px solid var(--line);padding-top:10px">
        <div><span style="color:var(--ink-muted)">Lab / Hospital:</span> <strong>${esc(doc.doctorOrLab || "—")}</strong></div>
        <div><span style="color:var(--ink-muted)">File:</span> <strong>${esc(doc.fileName || "—")} (${esc(doc.fileSize || "—")})</strong></div>
      </div>
      ${doc.notes ? `
        <div style="margin-top:14px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--blue-600);margin-bottom:4px">Key Findings & Notes</div>
          <div style="font-size:13px;color:#334155;line-height:1.5">${esc(doc.notes)}</div>
        </div>
      ` : ""}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="downloadDoc('${doc.id}')">⬇ ${t("btnDownload", "Download File")}</button>
        <button class="btn-secondary" onclick="printDoc('${doc.id}')">🖨️ ${t("btnPrint", "Print")}</button>
      </div>
      <button class="btn-cancel" style="color:#dc2626;border-color:#fca5a5" onclick="deleteDoc('${doc.id}')">🗑 ${t("btnDeleteDoc", "Delete")}</button>
    </div>
  `;

  openModal(`👁 ${esc(doc.title)}`, modalHtml);
  const modalCard = document.getElementById("modalCard");
  if (modalCard) modalCard.classList.add("lightbox-modal");
}

function downloadDoc(id) {
  const doc = (appData.documents || []).find(d => d.id === id);
  if (!doc || !doc.fileData) return;
  const a = document.createElement("a");
  a.href = doc.fileData;
  a.download = doc.fileName || "medical_document.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printDoc(id) {
  const doc = (appData.documents || []).find(d => d.id === id);
  if (!doc) return;
  const win = window.open("", "_blank");
  win.document.write(`
    <html>
      <head>
        <title>${doc.title}</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 20px; }
          img { max-width: 90%; max-height: 80vh; object-fit: contain; }
          .meta { margin-top: 20px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto; }
        </style>
      </head>
      <body>
        <h2>${doc.title}</h2>
        <p>Date: ${doc.date} | ${doc.doctorOrLab || ""}</p>
        <img src="${doc.fileData}">
        <div class="meta">
          <p><strong>Findings / Notes:</strong> ${doc.notes || "None"}</p>
        </div>
        <script>window.onload = function() { window.print(); };<\/script>
      </body>
    </html>
  `);
  win.document.close();
}

function deleteDoc(id) {
  if (!confirm(t("confirmDeleteDoc", "Are you sure you want to delete this document?"))) return;
  appData.documents = (appData.documents || []).filter(d => d.id !== id);
  saveData();
  closeModal();
  renderRecords();
  renderRecordsBadge();
  renderStatsGrid();
  showToast(t("docDeletedSuccess", "🗑 Medical document deleted."), "success");
}

/* ─────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────── */
function outcomeClass(o) {
  if (!o) return "nochange";
  const m = o.toLowerCase();
  if (m.includes("improv")) return "improved";
  if (m.includes("worsen")) return "worsened";
  if (m.includes("mixed")) return "mixed";
  return "nochange";
}

function outcomeIcon(o) {
  if (!o) return "➖";
  const m = o.toLowerCase();
  if (m.includes("improv")) return "✅";
  if (m.includes("worsen")) return "❌";
  if (m.includes("mixed")) return "⚡";
  return "➖";
}

function outcomeLabel(o) {
  return `${outcomeIcon(o)} ${translateOutcome(o)}`;
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

/* ─────────────────────────────────────────────
   KEYBOARD SHORTCUTS
───────────────────────────────────────────── */
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    closeLangMenu();
  }
});

// Enter key on login forms
document.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const loginPage = document.getElementById("loginPage");
    if (loginPage && !loginPage.classList.contains("hidden")) {
      const patientForm = document.getElementById("patientLoginForm");
      const doctorForm = document.getElementById("doctorLoginForm");
      const activeRole = (patientForm && !patientForm.classList.contains("hidden")) ? "patient" : "doctor";
      const otpBtn = document.getElementById(`${activeRole}MethodOtpBtn`);
      const isOtp = otpBtn && otpBtn.classList.contains("active");

      if (isOtp) {
        const otpBox = document.getElementById(`${activeRole}OtpBox`);
        if (otpBox && !otpBox.classList.contains("hidden")) {
          verifyLoginOtp(activeRole);
        } else {
          sendLoginOtp(activeRole);
        }
      } else {
        if (activeRole === "patient") loginPatient();
        else loginDoctor();
      }
    }
  }
});

// Close lang menus when clicking outside
document.addEventListener("click", e => {
  const sel = document.getElementById("langSelector");
  if (sel && !sel.contains(e.target)) closeLangMenu();
  const loginSel = document.getElementById("loginLangSelector");
  if (loginSel && !loginSel.contains(e.target)) closeLoginLangMenu();
});

/* ═══════════════════════════════════════════════════════════
   LANGUAGE SYSTEM — English / हिंदी / मराठी
═══════════════════════════════════════════════════════════ */

var TRANSLATIONS = {

  en: {
    // Nav
    navMain: "Main",
    navDoctors: "Doctors",
    navPatient: "Patient",
    navServices: "Services",
    navDashboard: "Dashboard",
    navDoctorA: "Doctor A",
    navDoctorB: "Doctor B",
    navHistory: "Patient History",
    navTimeline: "Timeline",
    navReports: "Reports",
    navProfile: "Profile",
    navPharmacy: "Pharmacy",
    navOrders: "My Orders",
    navReminders: "Reminders",
    // Topbar
    logout: "Logout",
    exportPdf: "Export PDF",
    // Login Page
    loginHeadline: "Your complete medical journey, in one place.",
    loginSub: "Track prescriptions, outcomes, patient history and treatment timelines — securely and simply.",
    featPrescriptions: "Prescription tracking",
    featOutcomes: "Medicine outcome analysis",
    featHistory: "Full patient history",
    featDoctorWise: "Doctor-wise records",
    loginCardTitle: "Sign in to your account",
    loginCardSub: "Patient or Doctor access",
    tabPatient: "🧑‍⚕️ Patient",
    tabDoctor: "⚕ Doctor",
    patientIdLabel: "Patient ID",
    doctorIdLabel: "Doctor ID",
    passwordLabel: "Password",
    patientIdPh: "e.g. PAT-001",
    doctorIdPh: "e.g. DR-A",
    passwordPh: "Enter password",
    btnSignInPatient: "Sign in as Patient",
    btnSignInDoctor: "Sign in as Doctor",
    demoPatientHint: "Demo: <code>PAT-001</code> / <code>patient123</code>",
    demoDoctorHint: "Doctor A: <code>DR-A</code> / <code>docA123</code><br>Doctor B: <code>DR-B</code> / <code>docB123</code>",
    // Dashboard
    dashEyebrow: "PATIENT VIEW",
    dashTitle: "Your treatment journey,\nin one place.",
    dashSub: "Track prescriptions, follow-ups, documented outcomes and your complete medical history — all in one secure dashboard.",
    dashBtnPrescription: "View Prescriptions",
    dashBtnHistory: "Patient History",
    dashStatMeds: "Total Medicines",
    dashStatImproved: "Improved Outcomes",
    dashStatDoctors: "Doctors Consulted",
    dashStatTimeline: "Timeline Events",
    dashTreatment: "Treatment Summary",
    dashActivity: "Recent Activity",
    statAcrossBoth: "Across both doctors",
    statOutOf: "Out of",
    statMedsWord: "medicines",
    statTwoDoctors: "Doctor A & Doctor B",
    statTreatmentEntries: "Treatment entries",
    treatmentDocA: "Doctor A",
    treatmentDocB: "Doctor B",
    currentOngoingMed: "Current Ongoing Medicine",
    pastMedicalHist: "Past Medical History",
    noRecentActivity: "No recent activity.",
    // Doctor sections
    doctorAEyebrow: "DOCTOR A — TREATMENT RECORDS",
    doctorBEyebrow: "DOCTOR B — TREATMENT RECORDS",
    prescribedMeds: "Prescribed Medicines & Outcomes",
    addMedicine: "+ Add Medicine",
    netOutcome: "Net Outcome",
    hospitalLabel: "Hospital",
    expLabel: "Experience",
    scheduleLabel: "Schedule",
    dosageLabel: "Dosage",
    durationLabel: "Duration",
    outcomeLabel: "Outcome",
    followupLabel: "Follow-up",
    editInfoBtn: "✏ Edit Info",
    noMedsYet: "No medicines prescribed yet.",
    treatmentSummaryFor: "Treatment Summary",
    outcomeDisclaimer: "ℹ Outcomes displayed are as documented in follow-up records. MED-TRACE does not claim the medicine caused the outcome.",
    // History
    historyEyebrow: "MEDICAL HISTORY",
    historyTitle: "Patient History",
    historySub: "Complete medical background — past illnesses, accidents, surgeries and allergies.",
    editHistory: "✏ Edit History",
    histIllness: "Past Illness / Chronic Conditions",
    histSurgery: "Surgeries / Procedures",
    histAccident: "Accidents / Trauma",
    histAllergy: "Known Allergies",
    histFamily: "Family Medical History",
    histOngoing: "Current / Ongoing Medicines",
    // Timeline
    timelineEyebrow: "TREATMENT JOURNEY",
    timelineTitle: "Timeline",
    timelineSub: "Chronological view of all treatments, prescriptions and follow-ups.",
    addEntry: "+ Add Entry",
    noTimelineYet: "No timeline entries yet.",
    editBtnText: "✏ Edit",
    doctorLabel: "Doctor",
    // Reports
    reportsEyebrow: "REPORTS & COMPARISON",
    reportsTitle: "Before vs. After Treatment",
    reportsSub: "Documented results before and after each doctor's treatment phase.",
    reportTabA: "Doctor A Report",
    reportTabB: "Doctor B Report",
    beforeTreatment: "Before Treatment",
    afterTreatment: "After Treatment",
    docLabel: "Doctor",
    firstMedLabel: "First Medicine",
    startDateLabel: "Start Date",
    reasonVisitLabel: "Reason for Visit",
    initialOutcomeLabel: "Initial Outcome",
    lastMedLabel: "Last Medicine",
    endDateLabel: "End Date",
    finalFollowupLabel: "Final Follow-up",
    effectSummaryLabel: "Effect Summary",
    noteText: "MED-TRACE displays documented results only. It does not claim that a medicine caused the outcome.",
    // Profile
    profileEyebrow: "PATIENT PROFILE",
    profileTitle: "Patient Details",
    editProfile: "✏ Edit Profile",
    personalInfo: "Personal Information",
    fullNameLabel: "Full Name",
    ageLabel: "Age",
    genderLabel: "Gender",
    bloodGroupLabel: "Blood Group",
    phoneLabel: "Phone",
    emailLabel: "Email",
    addressLabel: "Address",
    emergencyContactLabel: "Emergency Contact",
    statAge: "Age",
    statBlood: "Blood",
    statMedicines: "Medicines",
    genderMale: "Male",
    genderFemale: "Female",
    years: "years",
    rolePatient: "Patient",
    roleDocA: "Doctor A — Editor",
    roleDocB: "Doctor B — Editor",
    patientLabel: "Patient",
    // Pharmacy
    pharmaEyebrow: "💊 PHARMACY & DELIVERY",
    pharmaTitle: "Medicine Store",
    pharmaSub: "Order medicines from nearby pharmacies — delivered in 30-60 minutes.",
    deliveryBadge: "Delivery in 30-60 min",
    tabAllMeds: "All Medicines",
    tabLowStock: "🟡 Low Stock",
    tabOutOfStock: "🔴 Out of Stock",
    tabAvailable: "🟢 Available",
    nearbyPharmacies: "🏪 Nearby Pharmacies",
    inStock: "🟢 In Stock",
    lowStock: "🟡 Low Stock",
    outOfStock: "🔴 Out of Stock",
    orderNow: "🛒 Order Now",
    notifyMe: "🔔 Notify",
    stripsLeft: "strips left",
    stripLeft: "strip left",
    unavailable: "Unavailable",
    prescribedBy: "Prescribed by",
    outOfStockAlert: "out of stock",
    runningLowAlert: "running low",
    openLabel: "Open",
    closedLabel: "Closed",
    awayLabel: "away",
    noMedsFilter: "No medicines found for this filter.",
    medLabel: "Medicine",
    qtyLabel: "Quantity",
    paymentLabel: "Payment",
    pharmacyLabel: "Pharmacy",
    deliveryAddressLabel: "Delivery Address",
    // Orders
    ordersEyebrow: "🛵 ORDER TRACKING",
    ordersTitle: "My Orders",
    ordersSub: "Track your medicine delivery in real-time.",
    noOrders: "No orders yet",
    noOrdersSub: "Your medicine orders will appear here with live delivery tracking.",
    goToPharmacy: "💊 Go to Pharmacy",
    orderPlaced: "Order Placed",
    confirmed: "Confirmed",
    preparing: "Preparing",
    outForDelivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    minRemaining: "min remaining",
    arrivingMoment: "Arriving any moment...",
    deliveredSuccess: "Delivered successfully!",
    // Reminders
    remindersEyebrow: "🔔 MEDICINE REMINDERS",
    remindersHeading: "My Reminders",
    remindersSub: "Never miss a dose — get desktop notifications at the right time.",
    testMorningBtn: "⚡ Test Morning Dose (Medicine 1)",
    enableNotifBtn: "🔔 Enable Notifications",
    addReminderBtn: "+ Add Reminder",
    todaySchedule: "📅 Today's Schedule",
    allRemindersHeading: "All Medicine Reminders",
    takeNow: "⏰ Take Now!",
    takeBtn: "✓ Take",
    dueEarlier: "Due earlier",
    markTaken: "✓ Mark Taken",
    upcoming: "⏳ Upcoming",
    testBtn: "🔔 Test",
    takenAt: "✓ Taken at",
    noRemindersToday: "No active reminders scheduled for today.",
    noRemindersYet: "No reminders yet",
    everyDay: "Every day",
    // PDF labels
    pdfReportTitle: "Patient Medical Report",
    pdfGenerated: "Generated on",
    pdfPatientInfo: "Patient Information",
    pdfMedHistory: "Medical History",
    pdfDoctorA: "Doctor A — Prescriptions & Outcomes",
    pdfDoctorB: "Doctor B — Prescriptions & Outcomes",
    pdfTimeline: "Treatment Timeline",
    pdfDisclaimer: "This report is for informational purposes only. Outcomes shown are as documented in follow-up records. MED-TRACE does not claim any medicine caused the documented outcome.",
    // Common
    notDocumented: "Not documented",
    viewDetails: "👁 View",
    editBtn: "✏",
    deleteBtn: "🗑",
    // Medical Records & Pic Upload
    navRecords: "Upload & Scans",
    recordsEyebrow: "MEDICAL RECORDS & SCANS",
    recordsTitle: "Reports, X-Rays & Scans",
    recordsSub: "Upload your X-rays, blood reports, MRI scans, and medical documents directly from your device.",
    btnUploadDoc: "+ Upload Report / Scan",
    uploadPicBtn: "Upload Report / Scan",
    dashBtnRecords: "📷 Upload Scans & Reports",
    filterAllDocs: "All Documents",
    filterXray: "🩻 X-Rays",
    filterBlood: "🩸 Blood Reports",
    filterMri: "🧠 MRI / CT Scans",
    filterPrescription: "📄 Prescriptions",
    filterOther: "📋 Other",
    noDocsTitle: "No medical reports or scans uploaded yet",
    noDocsSub: "Upload your X-ray pictures, blood test results, MRI scans, or doctor prescriptions directly from your phone or computer.",
    btnUploadFirst: "📷 Upload Your First Document",
    modalUploadTitle: "📷 Upload Medical Report / Scan",
    dropzoneTitle: "Click to browse or drag & drop photo/report",
    dropzoneSub: "Supports JPG, PNG, WEBP, PDF (Max 15MB)",
    docCategoryLabel: "Document Category",
    docTitleLabel: "Report / Test Title",
    docTitlePh: "e.g. Chest X-Ray (PA View), Complete Blood Count",
    docLabLabel: "Lab / Hospital / Doctor",
    docLabPh: "e.g. Apollo Hospital, SRL Diagnostics, Dr. Verma",
    docDateLabel: "Report / Test Date",
    docNotesLabel: "Clinical Notes / Key Findings",
    docNotesPh: "e.g. Clear lung fields, Hemoglobin 14.2 g/dL, normal platelet count...",
    btnSaveDoc: "💾 Save & Upload Document",
    btnViewFull: "View",
    btnDownload: "Download",
    btnPrint: "Print",
    btnDeleteDoc: "Delete",
    confirmDeleteDoc: "Are you sure you want to delete this document?",
    docUploadedSuccess: "✅ Medical document uploaded successfully!",
    docDeletedSuccess: "🗑 Medical document deleted.",
    toastTitleOrFileRequired: "Please select a photo or enter a report title.",
    dashStatRecords: "Medical Records",
    statUploadedScans: "Scans & blood reports",
    pdfAttachedDocs: "Attached Medical Reports, X-Rays & Scans",
    docDefaultTitle: "Medical Document"
  },

  hi: {
    // Nav
    navMain: "मुख्य",
    navDoctors: "डॉक्टर",
    navPatient: "मरीज़",
    navServices: "सेवाएं",
    navDashboard: "डैशबोर्ड",
    navDoctorA: "डॉक्टर A",
    navDoctorB: "डॉक्टर B",
    navHistory: "मरीज़ का इतिहास",
    navTimeline: "समय-रेखा",
    navReports: "रिपोर्ट",
    navProfile: "प्रोफ़ाइल",
    navPharmacy: "फार्मेसी स्टोर",
    navOrders: "मेरे ऑर्डर",
    navReminders: "दवा रिमाइंडर",
    // Topbar
    logout: "लॉग आउट",
    exportPdf: "PDF निर्यात",
    // Login Page
    loginHeadline: "आपकी पूरी चिकित्सा यात्रा, एक सुरक्षित स्थान पर।",
    loginSub: "नुस्खे, परिणाम, मरीज़ का इतिहास और उपचार समय-रेखा — सरलता और सुरक्षा के साथ ट्रैक करें।",
    featPrescriptions: "नुस्खा और दवा ट्रैकिंग",
    featOutcomes: "दवा प्रभाव और परिणाम विश्लेषण",
    featHistory: "मरीज़ का संपूर्ण चिकित्सा इतिहास",
    featDoctorWise: "डॉक्टर-वार विस्तृत रिकॉर्ड",
    loginCardTitle: "अपने खाते में साइन इन करें",
    loginCardSub: "मरीज़ या डॉक्टर लॉगिन चुनें",
    tabPatient: "🧑‍⚕️ मरीज़",
    tabDoctor: "⚕ डॉक्टर",
    patientIdLabel: "मरीज़ आईडी",
    doctorIdLabel: "डॉक्टर आईडी",
    passwordLabel: "पासवर्ड",
    patientIdPh: "उदा. PAT-001",
    doctorIdPh: "उदा. DR-A",
    passwordPh: "पासवर्ड दर्ज करें",
    btnSignInPatient: "मरीज़ के रूप में साइन इन करें",
    btnSignInDoctor: "डॉक्टर के रूप में साइन इन करें",
    demoPatientHint: "डेमो मरीज़: <code>PAT-001</code> / <code>patient123</code>",
    demoDoctorHint: "डॉक्टर A: <code>DR-A</code> / <code>docA123</code><br>डॉक्टर B: <code>DR-B</code> / <code>docB123</code>",
    // Dashboard
    dashEyebrow: "मरीज़ का दृश्य",
    dashTitle: "आपकी उपचार यात्रा,\nएक जगह पर।",
    dashSub: "दवाइयाँ, फॉलो-अप, दर्ज परिणाम और आपका पूरा चिकित्सा इतिहास — एक सुरक्षित डैशबोर्ड में।",
    dashBtnPrescription: "नुस्खे देखें",
    dashBtnHistory: "मरीज़ का इतिहास",
    dashStatMeds: "कुल दवाइयाँ",
    dashStatImproved: "सुधरे परिणाम",
    dashStatDoctors: "परामर्श किए डॉक्टर",
    dashStatTimeline: "समय-रेखा की घटनाएँ",
    dashTreatment: "उपचार सारांश",
    dashActivity: "हालिया गतिविधि",
    statAcrossBoth: "दोनों डॉक्टरों के तहत",
    statOutOf: "कुल में से",
    statMedsWord: "दवाइयाँ",
    statTwoDoctors: "डॉक्टर A और डॉक्टर B",
    statTreatmentEntries: "उपचार की कुल प्रविष्टियाँ",
    treatmentDocA: "डॉक्टर A",
    treatmentDocB: "डॉक्टर B",
    currentOngoingMed: "वर्तमान में चल रही दवाई",
    pastMedicalHist: "पिछला चिकित्सा इतिहास",
    noRecentActivity: "हाल में कोई गतिविधि दर्ज नहीं है।",
    // Doctor sections
    doctorAEyebrow: "डॉक्टर A — उपचार रिकॉर्ड",
    doctorBEyebrow: "डॉक्टर B — उपचार रिकॉर्ड",
    prescribedMeds: "निर्धारित दवाइयाँ और परिणाम",
    addMedicine: "+ दवाई जोड़ें",
    netOutcome: "कुल परिणाम",
    hospitalLabel: "अस्पताल",
    expLabel: "अनुभव",
    scheduleLabel: "समय-सारणी",
    dosageLabel: "खुराक",
    durationLabel: "अवधि",
    outcomeLabel: "परिणाम",
    followupLabel: "फॉलो-अप तिथि",
    editInfoBtn: "✏ जानकारी संपादित करें",
    noMedsYet: "अभी कोई दवा निर्धारित नहीं की गई।",
    treatmentSummaryFor: "उपचार सारांश",
    outcomeDisclaimer: "ℹ प्रदर्शित परिणाम फॉलो-अप रिकॉर्ड से हैं। MED-TRACE यह दावा नहीं करता कि दवा से ही परिणाम हुआ।",
    // History
    historyEyebrow: "चिकित्सा इतिहास",
    historyTitle: "मरीज़ का इतिहास",
    historySub: "पूरी चिकित्सा पृष्ठभूमि — पुरानी बीमारियाँ, दुर्घटनाएँ, ऑपरेशन और एलर्जी।",
    editHistory: "✏ इतिहास संपादित करें",
    histIllness: "पिछली बीमारी / पुरानी बीमारी",
    histSurgery: "ऑपरेशन / प्रक्रियाएँ",
    histAccident: "दुर्घटना / आघात",
    histAllergy: "ज्ञात एलर्जी",
    histFamily: "पारिवारिक चिकित्सा इतिहास",
    histOngoing: "वर्तमान / चल रही दवाइयाँ",
    // Timeline
    timelineEyebrow: "उपचार यात्रा",
    timelineTitle: "समय-रेखा",
    timelineSub: "सभी उपचारों, नुस्खों और फॉलो-अप का कालक्रम।",
    addEntry: "+ प्रविष्टि जोड़ें",
    noTimelineYet: "अभी तक कोई समय-रेखा प्रविष्टि नहीं है।",
    editBtnText: "✏ संपादित करें",
    doctorLabel: "डॉक्टर",
    // Reports
    reportsEyebrow: "रिपोर्ट और तुलना",
    reportsTitle: "उपचार से पहले बनाम बाद में",
    reportsSub: "प्रत्येक डॉक्टर के उपचार चरण के पहले और बाद के दर्ज परिणाम।",
    reportTabA: "डॉक्टर A की रिपोर्ट",
    reportTabB: "डॉक्टर B की रिपोर्ट",
    beforeTreatment: "उपचार से पहले",
    afterTreatment: "उपचार के बाद",
    docLabel: "डॉक्टर",
    firstMedLabel: "पहली दवा",
    startDateLabel: "आरंभ तिथि",
    reasonVisitLabel: "परामर्श का कारण",
    initialOutcomeLabel: "प्रारंभिक परिणाम",
    lastMedLabel: "अंतिम दवा",
    endDateLabel: "समाप्ति तिथि",
    finalFollowupLabel: "अंतिम फॉलो-अप",
    effectSummaryLabel: "प्रभाव सारांश",
    noteText: "MED-TRACE केवल दर्ज परिणाम दिखाता है। यह दावा नहीं करता कि दवाई से परिणाम हुआ।",
    // Profile
    profileEyebrow: "मरीज़ की प्रोफ़ाइल",
    profileTitle: "मरीज़ का विवरण",
    editProfile: "✏ प्रोफ़ाइल संपादित करें",
    personalInfo: "व्यक्तिगत जानकारी",
    fullNameLabel: "पूरा नाम",
    ageLabel: "आयु",
    genderLabel: "लिंग",
    bloodGroupLabel: "रक्त समूह",
    phoneLabel: "फ़ोन नंबर",
    emailLabel: "ईमेल पता",
    addressLabel: "निवास का पता",
    emergencyContactLabel: "आपातकालीन संपर्क",
    statAge: "आयु",
    statBlood: "रक्त",
    statMedicines: "दवाइयाँ",
    genderMale: "पुरुष",
    genderFemale: "महिला",
    years: "वर्ष",
    rolePatient: "मरीज़",
    roleDocA: "डॉक्टर A — संपादक",
    roleDocB: "डॉक्टर B — संपादक",
    patientLabel: "मरीज़",
    // Pharmacy
    pharmaEyebrow: "💊 फार्मेसी और होम डिलीवरी",
    pharmaTitle: "दवाइयों का स्टोर",
    pharmaSub: "नजदीकी फार्मेसी से तुरंत दवा मंगवाएं — 30 से 60 मिनट में डिलीवरी।",
    deliveryBadge: "30-60 मिनट में डिलीवरी",
    tabAllMeds: "सभी दवाइयाँ",
    tabLowStock: "🟡 कम स्टॉक",
    tabOutOfStock: "🔴 स्टॉक खत्म",
    tabAvailable: "🟢 उपलब्ध दवाइयाँ",
    nearbyPharmacies: "🏪 नजदीकी प्रमाणित फार्मेसी",
    inStock: "🟢 स्टॉक में उपलब्ध",
    lowStock: "🟡 कम स्टॉक",
    outOfStock: "🔴 स्टॉक समाप्त",
    orderNow: "🛒 अभी ऑर्डर करें",
    notifyMe: "🔔 उपलब्ध होने पर बताएं",
    stripsLeft: "स्ट्रिप बची हैं",
    stripLeft: "स्ट्रिप बची है",
    unavailable: "अनुपलब्ध",
    prescribedBy: "डॉक्टर द्वारा अनुशंसित",
    outOfStockAlert: "का स्टॉक समाप्त",
    runningLowAlert: "का स्टॉक कम",
    openLabel: "खुली है",
    closedLabel: "बंद है",
    awayLabel: "दूरी",
    noMedsFilter: "इस श्रेणी में कोई दवा नहीं मिली।",
    medLabel: "दवा का नाम",
    qtyLabel: "मात्रा (स्ट्रिप्स)",
    paymentLabel: "भुगतान माध्यम",
    pharmacyLabel: "फार्मेसी",
    deliveryAddressLabel: "डिलीवरी का पता",
    // Orders
    ordersEyebrow: "🛵 लाइव ऑर्डर ट्रैकिंग",
    ordersTitle: "मेरे दवा ऑर्डर",
    ordersSub: "अपनी दवा डिलीवरी को रियल-टाइम में ट्रैक करें।",
    noOrders: "अभी कोई ऑर्डर नहीं है",
    noOrdersSub: "आपके दवा ऑर्डर लाइव ट्रैकिंग के साथ यहाँ दिखाई देंगे।",
    goToPharmacy: "💊 फार्मेसी स्टोर पर जाएँ",
    orderPlaced: "ऑर्डर दर्ज हुआ",
    confirmed: "पुष्टि की गई",
    preparing: "तैयार हो रहा है",
    outForDelivery: "डिलीवरी के लिए निकला",
    delivered: "सफलतापूर्वक डिलीवर हुआ",
    cancelled: "रद्द किया गया",
    minRemaining: "मिनट शेष",
    arrivingMoment: "किसी भी क्षण पहुँचने वाला है...",
    deliveredSuccess: "सफलतापूर्वक डिलीवर हुआ!",
    // Reminders
    remindersEyebrow: "🔔 दवा रिमाइंडर प्रणाली",
    remindersHeading: "मेरे दवा रिमाइंडर",
    remindersSub: "कभी कोई खुराक न भूलें — सही समय पर डेस्कटॉप और ध्वनि सूचनाएं प्राप्त करें।",
    testMorningBtn: "⚡ सुबह की खुराक टेस्ट करें (दवाई 1)",
    enableNotifBtn: "🔔 नोटिफिकेशन सक्षम करें",
    addReminderBtn: "+ नया रिमाइंडर जोड़ें",
    todaySchedule: "📅 आज का समय-सारणी (शेड्यूल)",
    allRemindersHeading: "सभी दवा रिमाइंडर",
    takeNow: "⏰ अभी दवाई लें!",
    takeBtn: "✓ दवाई ली",
    dueEarlier: "पहले का समय बाकी",
    markTaken: "✓ ली हुई चिह्नित करें",
    upcoming: "⏳ आने वाली खुराक",
    testBtn: "🔔 टेस्ट करें",
    takenAt: "✓ ली गई",
    noRemindersToday: "आज के लिए कोई सक्रिय रिमाइंडर नहीं है।",
    noRemindersYet: "अभी कोई रिमाइंडर नहीं बना है।",
    everyDay: "प्रतिदिन (हर रोज़)",
    // PDF labels
    pdfReportTitle: "मरीज़ की चिकित्सा रिपोर्ट",
    pdfGenerated: "तैयार किया गया",
    pdfPatientInfo: "मरीज़ की जानकारी",
    pdfMedHistory: "चिकित्सा इतिहास",
    pdfDoctorA: "डॉक्टर A — नुस्खे और परिणाम",
    pdfDoctorB: "डॉक्टर B — नुस्खे और परिणाम",
    pdfTimeline: "उपचार समय-रेखा",
    pdfDisclaimer: "यह रिपोर्ट केवल जानकारी के लिए है। दिखाए गए परिणाम फॉलो-अप रिकॉर्ड में दर्ज हैं। MED-TRACE यह दावा नहीं करता कि किसी दवाई के कारण कोई परिणाम हुआ।",
    // Common
    notDocumented: "दर्ज नहीं",
    viewDetails: "👁 देखें",
    editBtn: "✏",
    deleteBtn: "🗑",
    // Medical Records & Pic Upload
    navRecords: "अपलोड व स्कैन",
    recordsEyebrow: "चिकित्सा दस्तावेज और इमेजिंग",
    recordsTitle: "रिपोर्ट्स, एक्स-रे और स्कैन",
    recordsSub: "अपने डिवाइस से सीधे अपने एक्स-रे, ब्लड रिपोर्ट, एमआरआई और मेडिकल दस्तावेज अपलोड करें।",
    btnUploadDoc: "+ रिपोर्ट / स्कैन अपलोड करें",
    uploadPicBtn: "रिपोर्ट / स्कैन अपलोड करें",
    dashBtnRecords: "📷 स्कैन व रिपोर्ट अपलोड करें",
    filterAllDocs: "सभी दस्तावेज",
    filterXray: "🩻 एक्स-रे",
    filterBlood: "🩸 ब्लड रिपोर्ट",
    filterMri: "🧠 एमआरआई / सीटी",
    filterPrescription: "📄 पर्ची (Rx)",
    filterOther: "📋 अन्य",
    noDocsTitle: "अभी कोई मेडिकल रिपोर्ट या स्कैन अपलोड नहीं है",
    noDocsSub: "अपने फोन या कंप्यूटर से सीधे अपनी एक्स-रे तस्वीर, ब्लड टेस्ट रिपोर्ट, एमआरआई या डॉक्टर की पर्ची अपलोड करें।",
    btnUploadFirst: "📷 पहला दस्तावेज अपलोड करें",
    modalUploadTitle: "📷 मेडिकल रिपोर्ट / स्कैन अपलोड करें",
    dropzoneTitle: "फोटो/रिपोर्ट चुनने के लिए क्लिक करें या यहाँ ड्रैग करें",
    dropzoneSub: "JPG, PNG, WEBP, PDF समर्थित (अधिकतम 15MB)",
    docCategoryLabel: "दस्तावेज श्रेणी / प्रकार",
    docTitleLabel: "रिपोर्ट / जांच का शीर्षक",
    docTitlePh: "उदा. छाती का एक्स-रे, सीबीसी ब्लड टेस्ट",
    docLabLabel: "लैब / अस्पताल / डॉक्टर",
    docLabPh: "उदा. अपोलो हॉस्पिटल, एसआरएल डायग्नोस्टिक्स",
    docDateLabel: "रिपोर्ट / जांच की तारीख",
    docNotesLabel: "चिकित्सीय निष्कर्ष व मुख्य नोट्स",
    docNotesPh: "उदा. फेफड़े सामान्य, हीमोग्लोबिन 14.2 g/dL, सामान्य रिपोर्ट...",
    btnSaveDoc: "💾 दस्तावेज सहेजें और अपलोड करें",
    btnViewFull: "देखें",
    btnDownload: "डाउनलोड",
    btnPrint: "प्रिंट करें",
    btnDeleteDoc: "हटाएं",
    confirmDeleteDoc: "क्या आप वाकई इस दस्तावेज को हटाना चाहते हैं?",
    docUploadedSuccess: "✅ मेडिकल दस्तावेज सफलतापूर्वक अपलोड हो गया!",
    docDeletedSuccess: "🗑 मेडिकल दस्तावेज हटा दिया गया।",
    toastTitleOrFileRequired: "कृपया कोई फोटो चुनें या रिपोर्ट का नाम दर्ज करें।",
    dashStatRecords: "मेडिकल रिकॉर्ड्स",
    statUploadedScans: "स्कैन व ब्लड रिपोर्ट्स",
    pdfAttachedDocs: "संलग्न मेडिकल रिपोर्ट्स, एक्स-रे और स्कैन",
    docDefaultTitle: "चिकित्सा दस्तावेज"
  },

  mr: {
    // Nav
    navMain: "मुख्य",
    navDoctors: "डॉक्टर",
    navPatient: "रुग्ण",
    navServices: "सेवा",
    navDashboard: "डॅशबोर्ड",
    navDoctorA: "डॉक्टर A",
    navDoctorB: "डॉक्टर B",
    navHistory: "रुग्णाचा इतिहास",
    navTimeline: "कालरेषा",
    navReports: "अहवाल",
    navProfile: "प्रोफाइल",
    navPharmacy: "फार्मसी स्टोअर",
    navOrders: "माझ्या ऑर्डर्स",
    navReminders: "औषध स्मरणपत्र",
    // Topbar
    logout: "बाहेर पडा",
    exportPdf: "PDF निर्यात करा",
    // Login Page
    loginHeadline: "तुमचा संपूर्ण वैद्यकीय प्रवास, एका सुरक्षित ठिकाणी।",
    loginSub: "प्रिस्क्रिप्शन, निकाल, रुग्णाचा इतिहास आणि उपचार कालरेषा — सुरक्षितपणे आणि सहजपणे ट्रॅक करा।",
    featPrescriptions: "प्रिस्क्रिप्शन व औषध ट्रॅकिंग",
    featOutcomes: "औषध परिणाम आणि प्रभाव विश्लेषण",
    featHistory: "रुग्णाचा संपूर्ण वैद्यकीय इतिहास",
    featDoctorWise: "डॉक्टरनिहाय तपशीलवार नोंदी",
    loginCardTitle: "आपल्या खात्यात साइन इन करा",
    loginCardSub: "रुग्ण किंवा डॉक्टर लॉगिन निवडा",
    tabPatient: "🧑‍⚕️ रुग्ण",
    tabDoctor: "⚕ डॉक्टर",
    patientIdLabel: "रुग्ण आयडी",
    doctorIdLabel: "डॉक्टर आयडी",
    passwordLabel: "पासवर्ड",
    patientIdPh: "उदा. PAT-001",
    doctorIdPh: "उदा. DR-A",
    passwordPh: "पासवर्ड प्रविष्ट करा",
    btnSignInPatient: "रुग्ण म्हणून साइन इन करा",
    btnSignInDoctor: "डॉक्टर म्हणून साइन इन करा",
    demoPatientHint: "डेमो रुग्ण: <code>PAT-001</code> / <code>patient123</code>",
    demoDoctorHint: "डॉक्टर A: <code>DR-A</code> / <code>docA123</code><br>डॉक्टर B: <code>DR-B</code> / <code>docB123</code>",
    // Dashboard
    dashEyebrow: "रुग्णाचे दृश्य",
    dashTitle: "तुमचा उपचार प्रवास,\nएका ठिकाणी।",
    dashSub: "औषधे, फॉलो-अप, नोंदवलेले निकाल आणि संपूर्ण वैद्यकीय इतिहास — एका सुरक्षित डॅशबोर्डमध्ये।",
    dashBtnPrescription: "प्रिस्क्रिप्शन पाहा",
    dashBtnHistory: "रुग्णाचा इतिहास",
    dashStatMeds: "एकूण औषधे",
    dashStatImproved: "सुधारलेले निकाल",
    dashStatDoctors: "सल्ला घेतलेले डॉक्टर",
    dashStatTimeline: "कालरेषा नोंदी",
    dashTreatment: "उपचार सारांश",
    dashActivity: "अलीकडील क्रियाकलाप",
    statAcrossBoth: "दोन्ही डॉक्टरांच्या अंतर्गत",
    statOutOf: "एकूण पैकी",
    statMedsWord: "औषधे",
    statTwoDoctors: "डॉक्टर A आणि डॉक्टर B",
    statTreatmentEntries: "उपचाराच्या एकूण नोंदी",
    treatmentDocA: "डॉक्टर A",
    treatmentDocB: "डॉक्टर B",
    currentOngoingMed: "सध्या चालू असलेले औषध",
    pastMedicalHist: "मागील वैद्यकीय इतिहास",
    noRecentActivity: "नुकतीच कोणतीही हालचाल नोंदवलेली नाही.",
    // Doctor sections
    doctorAEyebrow: "डॉक्टर A — उपचार नोंदी",
    doctorBEyebrow: "डॉक्टर B — उपचार नोंदी",
    prescribedMeds: "लिहून दिलेली औषधे आणि निकाल",
    addMedicine: "+ औषध जोडा",
    netOutcome: "एकूण निकाल",
    hospitalLabel: "रुग्णालय",
    expLabel: "अनुभव",
    scheduleLabel: "वेळापत्रक",
    dosageLabel: "डोस",
    durationLabel: "कालावधी",
    outcomeLabel: "निकाल",
    followupLabel: "फॉलो-अप तारीख",
    editInfoBtn: "✏ माहिती संपादित करा",
    noMedsYet: "अद्याप औषध लिहून दिलेले नाही.",
    treatmentSummaryFor: "उपचार सारांश",
    outcomeDisclaimer: "ℹ दाखवलेले निकाल फॉलो-अप नोंदींमधून आहेत. MED-TRACE औषधामुळेच निकाल झाला असा दावा करत नाही.",
    // History
    historyEyebrow: "वैद्यकीय इतिहास",
    historyTitle: "रुग्णाचा इतिहास",
    historySub: "संपूर्ण वैद्यकीय पार्श्वभूमी — जुने आजार, अपघात, शस्त्रक्रिया आणि ऍलर्जी।",
    editHistory: "✏ इतिहास संपादित करा",
    histIllness: "जुना आजार / दीर्घकालीन आजार",
    histSurgery: "शस्त्रक्रिया / प्रक्रिया",
    histAccident: "अपघात / आघात",
    histAllergy: "ज्ञात ऍलर्जी",
    histFamily: "कौटुंबिक वैद्यकीय इतिहास",
    histOngoing: "सध्याची / चालू औषधे",
    // Timeline
    timelineEyebrow: "उपचार प्रवास",
    timelineTitle: "कालरेषा",
    timelineSub: "सर्व उपचार, प्रिस्क्रिप्शन आणि फॉलो-अपचा कालानुक्रमिक आढावा।",
    addEntry: "+ नोंद जोडा",
    noTimelineYet: "अद्याप कोणतीही कालरेषा नोंद नाही.",
    editBtnText: "✏ संपादित करा",
    doctorLabel: "डॉक्टर",
    // Reports
    reportsEyebrow: "अहवाल आणि तुलना",
    reportsTitle: "उपचारापूर्वी विरुद्ध नंतर",
    reportsSub: "प्रत्येक डॉक्टरच्या उपचार टप्प्यापूर्वी आणि नंतरचे नोंदवलेले निकाल।",
    reportTabA: "डॉक्टर A अहवाल",
    reportTabB: "डॉक्टर B अहवाल",
    beforeTreatment: "उपचारापूर्वी",
    afterTreatment: "उपचारानंतर",
    docLabel: "डॉक्टर",
    firstMedLabel: "पहिले औषध",
    startDateLabel: "सुरुवात तारीख",
    reasonVisitLabel: "भेटीचे कारण",
    initialOutcomeLabel: "सुरुवातीचा निकाल",
    lastMedLabel: "शेवटचे औषध",
    endDateLabel: "समाप्ती तारीख",
    finalFollowupLabel: "अंतिम फॉलो-अप",
    effectSummaryLabel: "प्रभाव सारांश",
    noteText: "MED-TRACE फक्त नोंदवलेले निकाल दाखवतो. औषधामुळे निकाल झाला असा दावा नाही.",
    // Profile
    profileEyebrow: "रुग्णाची प्रोफाइल",
    profileTitle: "रुग्णाचा तपशील",
    editProfile: "✏ प्रोफाइल संपादित करा",
    personalInfo: "वैयक्तिक माहिती",
    fullNameLabel: "पूर्ण नाव",
    ageLabel: "वय",
    genderLabel: "लिंग",
    bloodGroupLabel: "रक्तगट",
    phoneLabel: "फोन नंबर",
    emailLabel: "ईमेल पत्ता",
    addressLabel: "राहण्याचा पत्ता",
    emergencyContactLabel: "तातडीचा संपर्क",
    statAge: "वय",
    statBlood: "रक्त",
    statMedicines: "औषधे",
    genderMale: "पुरुष",
    genderFemale: "महिला",
    years: "वर्षे",
    rolePatient: "रुग्ण",
    roleDocA: "डॉक्टर A — संपादक",
    roleDocB: "डॉक्टर B — संपादक",
    patientLabel: "रुग्ण",
    // Pharmacy
    pharmaEyebrow: "💊 फार्मसी आणि होम डिलिव्हरी",
    pharmaTitle: "औषध स्टोअर",
    pharmaSub: "जवळच्या फार्मसीमधून तात्काळ औषधे मागवा — ३० ते ६० मिनिटांत डिलिव्हरी।",
    deliveryBadge: "३०-६० मिनिटांत डिलिव्हरी",
    tabAllMeds: "सर्व औषधे",
    tabLowStock: "🟡 कमी साठा",
    tabOutOfStock: "🔴 साठा संपला",
    tabAvailable: "🟢 उपलब्ध औषधे",
    nearbyPharmacies: "🏪 जवळील प्रमाणित फार्मसी",
    inStock: "🟢 साठ्यात उपलब्ध",
    lowStock: "🟡 कमी साठा",
    outOfStock: "🔴 साठा संपला",
    orderNow: "🛒 आता ऑर्डर करा",
    notifyMe: "🔔 उपलब्ध झाल्यावर कळवा",
    stripsLeft: "पट्ट्या शिल्लक",
    stripLeft: "पट्टी शिल्लक",
    unavailable: "अनुपलब्ध",
    prescribedBy: "डॉक्टरांनी लिहून दिलेले",
    outOfStockAlert: "चा साठा संपला",
    runningLowAlert: "चा साठा कमी",
    openLabel: "सुरू आहे",
    closedLabel: "बंद आहे",
    awayLabel: "अंतरावर",
    noMedsFilter: "या श्रेणीत औषधे आढळली नाहीत.",
    medLabel: "औषधाचे नाव",
    qtyLabel: "प्रमाण (पट्ट्या)",
    paymentLabel: "पेमेंट पद्धत",
    pharmacyLabel: "फार्मसी",
    deliveryAddressLabel: "डिलिव्हरीचा पत्ता",
    // Orders
    ordersEyebrow: "🛵 थेट ऑर्डर ट्रॅकिंग",
    ordersTitle: "माझ्या औषध ऑर्डर्स",
    ordersSub: "आपली औषध डिलिव्हरी थेट ट्रॅक करा।",
    noOrders: "अद्याप कोणतीही ऑर्डर नाही",
    noOrdersSub: "आपल्या औषधांच्या ऑर्डर्स थेट ट्रॅकिंगसह येथे दिसतील.",
    goToPharmacy: "💊 फार्मसी स्टोअरवर जा",
    orderPlaced: "ऑर्डर नोंदवली",
    confirmed: "पुष्टी केली",
    preparing: "तयार होत आहे",
    outForDelivery: "डिलिव्हरीसाठी निघाले",
    delivered: "यशस्वीरित्या पोहोचवले",
    cancelled: "रद्द केले",
    minRemaining: "मिनिटे शिल्लक",
    arrivingMoment: "काही क्षणात पोहोचत आहे...",
    deliveredSuccess: "यशस्वीरित्या पोहोचवले!",
    // Reminders
    remindersEyebrow: "🔔 औषध स्मरणपत्र प्रणाली",
    remindersHeading: "माझी औषध स्मरणपत्रे",
    remindersSub: "कधीही डोस विसरू नका — योग्य वेळी डेस्कटॉप आणि ध्वनी सूचना मिळवा।",
    testMorningBtn: "⚡ सकाळचा डोस तपासा (औषध १)",
    enableNotifBtn: "🔔 सूचना सुरू करा",
    addReminderBtn: "+ नवीन स्मरणपत्र जोडा",
    todaySchedule: "📅 आजचे वेळापत्रक",
    allRemindersHeading: "सर्व औषध स्मरणपत्रे",
    takeNow: "⏰ आता औषध घ्या!",
    takeBtn: "✓ औषध घेतले",
    dueEarlier: "मागील वेळेची बाकी",
    markTaken: "✓ घेतले म्हणून नोंदवा",
    upcoming: "⏳ पुढील डोस",
    testBtn: "🔔 चाचणी",
    takenAt: "✓ घेतले",
    noRemindersToday: "आजसाठी कोणतेही सक्रिय स्मरणपत्र नाही.",
    noRemindersYet: "अद्याप कोणतेही स्मरणपत्र तयार केलेले नाही.",
    everyDay: "दररोज",
    // PDF labels
    pdfReportTitle: "रुग्णाचा वैद्यकीय अहवाल",
    pdfGenerated: "तयार केले",
    pdfPatientInfo: "रुग्णाची माहिती",
    pdfMedHistory: "वैद्यकीय इतिहास",
    pdfDoctorA: "डॉक्टर A — प्रिस्क्रिप्शन आणि निकाल",
    pdfDoctorB: "डॉक्टर B — प्रिस्क्रिप्शन आणि निकाल",
    pdfTimeline: "उपचार कालरेषा",
    pdfDisclaimer: "हा अहवाल केवळ माहितीसाठी आहे. दाखवलेले निकाल फॉलो-अप नोंदींमधून आहेत. MED-TRACE कोणत्याही औषधामुळे निकाल झाला असा दावा करत नाही।",
    // Common
    notDocumented: "नोंदवले नाही",
    viewDetails: "👁 पाहा",
    editBtn: "✏",
    deleteBtn: "🗑",
    // Medical Records & Pic Upload
    navRecords: "अपलोड आणि स्कॅन",
    recordsEyebrow: "वैद्यकीय कागदपत्रे आणि इमेजिंग",
    recordsTitle: "अहवाल, एक्स-रे आणि स्कॅन",
    recordsSub: "आपल्या डिव्हाइसवरून थेट आपले एक्स-रे, रक्त तपासणी अहवाल आणि कागदपत्रे अपलोड करा.",
    btnUploadDoc: "+ अहवाल / स्कॅन अपलोड करा",
    uploadPicBtn: "अहवाल / स्कॅन अपलोड करा",
    dashBtnRecords: "📷 स्कॅन व अहवाल अपलोड करा",
    filterAllDocs: "सर्व कागदपत्रे",
    filterXray: "🩻 एक्स-रे",
    filterBlood: "🩸 रक्त तपासणी अहवाल",
    filterMri: "🧠 एमआरआय / सीटी",
    filterPrescription: "📄 औषध चिठ्ठी (Rx)",
    filterOther: "📋 इतर",
    noDocsTitle: "अद्याप कोणतेही वैद्यकीय अहवाल किंवा स्कॅन अपलोड केलेले नाहीत",
    noDocsSub: "आपल्या फोन किंवा कॉम्प्युटरवरून थेट एक्स-रे फोटो, रक्त तपासणी अहवाल किंवा डॉक्टरांची चिठ्ठी अपलोड करा.",
    btnUploadFirst: "📷 पहिले कागदपत्र अपलोड करा",
    modalUploadTitle: "📷 वैद्यकीय अहवाल / स्कॅन अपलोड करा",
    dropzoneTitle: "फोटो/अहवाल निवडण्यासाठी क्लिक करा किंवा येथे ड्रॅग करा",
    dropzoneSub: "JPG, PNG, WEBP, PDF समर्थित (जास्तीत जास्त 15MB)",
    docCategoryLabel: "कागदपत्राचा प्रकार",
    docTitleLabel: "अहवाल / चाचणीचे शीर्षक",
    docTitlePh: "उदा. छातीचा एक्स-रे, सीबीसी रक्त तपासणी",
    docLabLabel: "लॅब / रुग्णालय / डॉक्टर",
    docLabPh: "उदा. अपोलो रुग्णालय, एसआरएल डायग्नोस्टिक्स",
    docDateLabel: "अहवाल / चाचणीची तारीख",
    docNotesLabel: "वैद्यकीय निष्कर्ष आणि नोंदी",
    docNotesPh: "उदा. फुफ्फुसे सामान्य, हिमोग्लोबिन 14.2 g/dL, सामान्य अहवाल...",
    btnSaveDoc: "💾 कागदपत्र जतन करा आणि अपलोड करा",
    btnViewFull: "पहा",
    btnDownload: "डाउनलोड",
    btnPrint: "प्रिंट करा",
    btnDeleteDoc: "हटवा",
    confirmDeleteDoc: "आपण खात्रीपूर्वक हे कागदपत्र हटवू इच्छिता?",
    docUploadedSuccess: "✅ वैद्यकीय कागदपत्र यशस्वीरित्या अपलोड झाले!",
    docDeletedSuccess: "🗑 वैद्यकीय कागदपत्र हटवले गेले.",
    toastTitleOrFileRequired: "कृपया एक फोटो निवडा किंवा अहवालाचे नाव प्रविष्ट करा.",
    dashStatRecords: "वैद्यकीय नोंदी",
    statUploadedScans: "स्कॅन आणि रक्त अहवाल",
    pdfAttachedDocs: "जोडलेले वैद्यकीय अहवाल, एक्स-रे आणि स्कॅन",
    docDefaultTitle: "वैद्यकीय कागदपत्र"
  }
};

/* ─────────────────────────────────────────────
   CLINICAL & MEDICAL TRANSLATION DICTIONARY
   Translates Aarav's seed medical history,
   prescribed drug reasons, notes, timeline entries,
   and schedule labels dynamically.
───────────────────────────────────────────── */
var CLINICAL_TRANSLATIONS = {
  hi: {
    // Patient History
    "Hypertension (High Blood Pressure) — Diagnosed January 2019. Currently managed with medication. No hospitalization required.":
      "हाइपरटेंशन (उच्च रक्तचाप) — जनवरी 2019 में निदान। वर्तमान में दवा द्वारा नियंत्रित। अस्पताल में भर्ती होने की आवश्यकता नहीं पड़ी।",
    "Appendix removal (Appendectomy) — June 2015. Laparoscopic procedure, full recovery in 3 weeks. No complications.":
      "अपेंडिक्स ऑपरेशन (अपेंडेक्टॉमी) — जून 2015। लेप्रोस्कोपिक प्रक्रिया, 3 सप्ताह में पूर्ण सुधार। कोई जटिलता नहीं।",
    "Minor road accident — March 2020. Soft tissue injury to left shoulder. Physiotherapy done for 6 weeks. Fully recovered.":
      "मामूली सड़क दुर्घटना — मार्च 2020। बाएं कंधे में कोमल ऊतक की चोट। 6 सप्ताह तक फिजियोथेरेपी की गई। पूरी तरह स्वस्थ।",
    "Penicillin — Causes rash and mild anaphylaxis. Documented in 2018. Avoid all penicillin-based antibiotics.":
      "पेनिसिलिन — चकत्ते और हल्का एनाफिलेक्सिस होता है। 2018 में दर्ज। सभी पेनिसिलिन आधारित एंटीबायोटिक दवाओं से बचें।",
    "Father: Type 2 Diabetes, Heart Disease. Mother: Hypertension, Thyroid. No known cancer history in family.":
      "पिता: टाइप 2 मधुमेह, हृदय रोग। माता: उच्च रक्तचाप, थायरॉयड। परिवार में कैंसर का कोई ज्ञात इतिहास नहीं।",
    "Amlodipine 5mg — Once daily (night) for hypertension. Prescribed by Doctor B.":
      "एम्लोडिपिन 5mg — उच्च रक्तचाप के लिए दिन में एक बार (रात)। डॉक्टर B द्वारा निर्धारित।",

    // Medicine Reasons & Effects
    "To control blood pressure": "रक्तचाप नियंत्रित करने के लिए",
    "Blood pressure did not improve. Patient reported dizziness and fatigue. Medicine discontinued after follow-up.":
      "रक्तचाप में सुधार नहीं हुआ। मरीज़ ने चक्कर और थकान की शिकायत की। फॉलो-अप के बाद दवा बंद कर दी गई।",
    "Alternative after Losartan failure — better BP control": "लोसार्टन विफल होने के बाद विकल्प — बेहतर बीपी नियंत्रण",
    "Blood pressure stabilized to 128/82 after 2 weeks. Patient tolerated well with no side effects.":
      "2 सप्ताह बाद रक्तचाप 128/82 पर स्थिर हो गया। मरीज़ ने बिना किसी दुष्प्रभाव के अच्छी तरह सहन किया।",
    "Calcium channel blocker — better for patient profile": "कैल्शियम चैनल अवरोधक — मरीज़ की प्रोफ़ाइल के लिए बेहतर",
    "BP consistently at 122/78. No side effects. Patient reports improved energy levels and sleep quality.":
      "बीपी लगातार 122/78 पर। कोई दुष्प्रभाव नहीं। मरीज़ ने ऊर्जा स्तर और नींद की गुणवत्ता में सुधार की सूचना दी।",
    "Preventive antiplatelet therapy": "निवारक एंटीप्लेटलेट थेरेपी",
    "No adverse effects. Completed course. Discontinued after review as risk factors not significant enough.":
      "कोई प्रतिकूल प्रभाव नहीं। कोर्स पूरा हुआ। समीक्षा के बाद बंद किया गया क्योंकि जोखिम कारक पर्याप्त नहीं थे।",

    // Timeline Titles & Descriptions
    "First Consultation — Doctor A": "पहला परामर्श — डॉक्टर A",
    "Patient visited Dr. Rajesh Verma with complaints of high blood pressure (BP: 158/96), mild headaches, and fatigue. Diagnosed with Stage 1 Hypertension.":
      "मरीज़ उच्च रक्तचाप (BP: 158/96), हल्के सिरदर्द और थकान की शिकायत लेकर डॉ. राजेश वर्मा के पास आया। स्टेज 1 हाइपरटेंशन का निदान हुआ।",
    "Follow-up — Doctor A (Medicine Changed)": "फॉलो-अप — डॉक्टर A (दवा बदली गई)",
    "Follow-up visit. Losartan 50mg showed no improvement. BP still at 152/94. Medicine changed to Telmisartan 40mg after consultation.":
      "फॉलो-अप परामर्श। लोसार्टन 50mg से कोई सुधार नहीं दिखा। बीपी अभी भी 152/94 पर था। परामर्श के बाद दवा बदलकर टेलमिसार्टन 40mg कर दी गई।",
    "Follow-up — Doctor A (Improved)": "फॉलो-अप — डॉक्टर A (सुधार हुआ)",
    "Telmisartan showing results. BP at 128/82. Patient referred to cardiologist (Doctor B) for specialist opinion.":
      "टेलमिसार्टन परिणाम दिखा रहा है। बीपी 128/82 पर। विशेषज्ञ राय के लिए मरीज़ को हृदय रोग विशेषज्ञ (डॉक्टर B) के पास भेजा गया।",
    "First Consultation — Doctor B": "पहला परामर्श — डॉक्टर B",
    "Dr. Meena Kapoor reviewed case. Switched to Amlodipine 5mg (better for patient profile) and added Aspirin 75mg as preventive care.":
      "डॉ. मीना कपूर ने मामले की समीक्षा की। एम्लोडिपिन 5mg शुरू की (मरीज़ के लिए बेहतर) और निवारक देखभाल के रूप में एस्पिरिन 75mg जोड़ी।",
    "Follow-up — Doctor B (Ongoing)": "फॉलो-अप — डॉक्टर B (जारी)",
    "BP consistently at 122/78. Patient reports improved energy and sleep. Aspirin course completed and discontinued. Amlodipine continued.":
      "बीपी लगातार 122/78 पर। मरीज़ ने बेहतर ऊर्जा और नींद की सूचना दी। एस्पिरिन कोर्स पूरा होकर बंद हुआ। एम्लोडिपिन जारी रखी गई।",

    // Reminders & Medicines
    "Medicine 1 (Pantoprazole 40mg)": "दवाई 1 (पैंटोप्राजोल 40mg)",
    "Medicine 2 (Telmisartan 40mg)": "दवाई 2 (टेलमिसार्टन 40mg)",
    "Medicine 3 (Aspirin 75mg)": "दवाई 3 (एस्पिरिन 75mg)",
    "Medicine 4 (Multivitamin & Zinc)": "दवाई 4 (मल्टीविटामिन और जिंक)",
    "Medicine 5 (Calcium + Vitamin D3)": "दवाई 5 (कैल्शियम + विटामिन D3)",
    "Medicine B (Amlodipine 5mg)": "दवाई B (एम्लोडिपिन 5mg)",
    "Medicine 7 (Atorvastatin 10mg)": "दवाई 7 (एटोरवास्टेटिन 10mg)",
    "Before Breakfast": "नाश्ते से पहले",
    "After Breakfast": "नाश्ते के बाद",
    "After Lunch": "दोपहर के भोजन के बाद",
    "Evening Snack": "शाम के नाश्ते के साथ",
    "After Dinner · Before Bed": "रात के खाने के बाद · सोने से पहले",
    "Before Sleep": "सोने से पहले",
    "Take on empty stomach 30 mins before breakfast with plain water.":
      "नाश्ते से 30 मिनट पहले खाली पेट सादे पानी के साथ लें।",
    "Doctor A prescribed for blood pressure control. Take after breakfast.":
      "डॉक्टर A ने रक्तचाप नियंत्रण के लिए निर्धारित किया। नाश्ते के बाद लें।",
    "Take with full glass of water after breakfast. Antiplatelet preventive care.":
      "नाश्ते के बाद एक पूरा गिलास पानी के साथ लें। निवारक देखभाल।",
    "Immunity and metabolic support. Take after lunch.":
      "रोग प्रतिरोधक क्षमता और चयापचय सहायता। दोपहर के भोजन के बाद लें।",
    "Bone health and daily supplement. Take after light evening snack.":
      "हड्डियों के स्वास्थ्य और दैनिक पूरक। शाम के हल्के नाश्ते के बाद लें।",
    "Doctor B prescribed for evening blood pressure stability. Take consistently at 9:00 PM.":
      "डॉक्टर B ने शाम के रक्तचाप की स्थिरता के लिए निर्धारित किया। रात 9:00 बजे नियमित लें।",
    "Lipid and cholesterol management. Best absorbed during nighttime rest.":
      "लिपिड और कोलेस्ट्रॉल प्रबंधन। रात के आराम के दौरान सबसे अच्छा अवशोषित होता है।",

    // Names & Specialities
    "Dr. Rajesh Verma": "डॉ. राजेश वर्मा",
    "Dr. Meena Kapoor": "डॉ. मीना कपूर",
    "Aarav Sharma": "आरव शर्मा",
    "Internal Medicine — MBBS, MD": "इंटरनल मेडिसिन — MBBS, MD",
    "Cardiology — MBBS, MD, DM (Cardiology)": "कार्डियोलॉजी — MBBS, MD, DM (कार्डियोलॉजी)",
    "Apollo Hospital, New Delhi": "अपोलो अस्पताल, नई दिल्ली",
    "AIIMS, New Delhi": "एम्स, नई दिल्ली",
    "14 years": "14 वर्ष",
    "19 years": "19 वर्ष",
    "1 tablet": "1 गोली",
    "Ongoing": "जारी है",
    "30 days": "30 दिन"
  },

  mr: {
    // Patient History
    "Hypertension (High Blood Pressure) — Diagnosed January 2019. Currently managed with medication. No hospitalization required.":
      "हायपरटेन्शन (उच्च रक्तदाब) — जानेवारी 2019 मध्ये निदान। सध्या औषधांनी नियंत्रित। रुग्णालयात दाखल होण्याची गरज नाही.",
    "Appendix removal (Appendectomy) — June 2015. Laparoscopic procedure, full recovery in 3 weeks. No complications.":
      "अपेंडिक्स शस्त्रक्रिया (अपेंडेक्टॉमी) — जून 2015। लॅपरोस्कोपिक प्रक्रिया, 3 आठवड्यांत पूर्ण बरे झाले। कोणतीही गुंतागुंत नाही.",
    "Minor road accident — March 2020. Soft tissue injury to left shoulder. Physiotherapy done for 6 weeks. Fully recovered.":
      "किरकोळ रस्ता अपघात — मार्च 2020। डाव्या खांद्याला मऊ ऊतींची दुखापत। 6 आठवडे फिजिओथेरपी केली। पूर्णपणे बरे झाले.",
    "Penicillin — Causes rash and mild anaphylaxis. Documented in 2018. Avoid all penicillin-based antibiotics.":
      "पेनिसिलिन — पुरळ आणि सौम्य ॲनाफिलेक्सिस होतो। 2018 मध्ये नोंदवले। सर्व पेनिसिलिन-आधारित अँटीबायोटिक्स टाळा.",
    "Father: Type 2 Diabetes, Heart Disease. Mother: Hypertension, Thyroid. No known cancer history in family.":
      "वडील: टाइप 2 मधुमेह, हृदयरोग। आई: उच्च रक्तदाब, थायरॉईड। कुटुंबात कर्करोगाचा कोणताही इतिहास नाही.",
    "Amlodipine 5mg — Once daily (night) for hypertension. Prescribed by Doctor B.":
      "अम्लोडिपाइन 5mg — उच्च रक्तदाबासाठी दिवसातून एकदा (रात्री)। डॉक्टर B द्वारे लिहून दिले.",

    // Medicine Reasons & Effects
    "To control blood pressure": "रक्तदाब नियंत्रित करण्यासाठी",
    "Blood pressure did not improve. Patient reported dizziness and fatigue. Medicine discontinued after follow-up.":
      "रक्तदाबात सुधारणा झाली नाही. रुग्णाने चक्कर येणे आणि थकव्याची तक्रार केली. फॉलो-अप नंतर औषध बंद केले.",
    "Alternative after Losartan failure — better BP control": "लोसार्टन अयशस्वी झाल्यानंतर पर्याय — उत्तम बीपी नियंत्रण",
    "Blood pressure stabilized to 128/82 after 2 weeks. Patient tolerated well with no side effects.":
      "2 आठवड्यांनंतर रक्तदाब 128/82 वर स्थिर झाला. रुग्णाने कोणत्याही दुष्परिणामांशिवाय चांगल्या प्रकारे सहन केले.",
    "Calcium channel blocker — better for patient profile": "कॅल्शियम चॅनेल ब्लॉकर — रुग्णाच्या स्थितीसाठी अधिक अनुकूल",
    "BP consistently at 122/78. No side effects. Patient reports improved energy levels and sleep quality.":
      "बीपी सातत्याने 122/78 वर. कोणतेही दुष्परिणाम नाहीत. रुग्णाने ऊर्जेची पातळी आणि झोपेच्या दर्जात सुधारणा नोंदवली.",
    "Preventive antiplatelet therapy": "प्रतिबंधक अँटीप्लेटलेट थेरपी",
    "No adverse effects. Completed course. Discontinued after review as risk factors not significant enough.":
      "कोणतेही विपरीत परिणाम नाहीत. कोर्स पूर्ण झाला. जोखीम घटक पुरेसे नसल्याने पुनरावलोकनानंतर बंद केले.",

    // Timeline Titles & Descriptions
    "First Consultation — Doctor A": "पहिली भेट — डॉक्टर A",
    "Patient visited Dr. Rajesh Verma with complaints of high blood pressure (BP: 158/96), mild headaches, and fatigue. Diagnosed with Stage 1 Hypertension.":
      "रुग्ण उच्च रक्तदाब (BP: 158/96), सौम्य डोकेदुखी आणि थकव्याच्या तक्रारीसह डॉ. राजेश वर्मा यांच्याकडे आला. स्टेज 1 हायपरटेन्शनचे निदान झाले.",
    "Follow-up — Doctor A (Medicine Changed)": "फॉलो-अप — डॉक्टर A (औषध बदलले)",
    "Follow-up visit. Losartan 50mg showed no improvement. BP still at 152/94. Medicine changed to Telmisartan 40mg after consultation.":
      "फॉलो-अप भेट. लोसार्टन 50mg ने कोणतीही सुधारणा दाखवली नाही. बीपी अजूनही 152/94 वर होता. सल्ल्यानंतर औषध बदलून टेल्मिसार्टन 40mg केले.",
    "Follow-up — Doctor A (Improved)": "फॉलो-अप — डॉक्टर A (सुधारणा झाली)",
    "Telmisartan showing results. BP at 128/82. Patient referred to cardiologist (Doctor B) for specialist opinion.":
      "टेल्मिसार्टन परिणाम दाखवत आहे. बीपी 128/82 वर. तज्ज्ञ मतासाठी रुग्णाला हृदयरोगतज्ज्ञांकडे (डॉक्टर B) संदर्भित केले.",
    "First Consultation — Doctor B": "पहिली भेट — डॉक्टर B",
    "Dr. Meena Kapoor reviewed case. Switched to Amlodipine 5mg (better for patient profile) and added Aspirin 75mg as preventive care.":
      "डॉ. मीना कपूर यांनी केसचे पुनरावलोकन केले. अम्लोडिपाइन 5mg सुरू केले (रुग्णासाठी उत्तम) आणि प्रतिबंधात्मक काळजी म्हणून ॲस्पिरिन 75mg जोडले.",
    "Follow-up — Doctor B (Ongoing)": "फॉलो-अप — डॉक्टर B (चालू)",
    "BP consistently at 122/78. Patient reports improved energy and sleep. Aspirin course completed and discontinued. Amlodipine continued.":
      "बीपी सातत्याने 122/78 वर. रुग्णाने सुधारलेली ऊर्जा आणि झोपेची नोंद केली. ॲस्पिरिन कोर्स पूर्ण होऊन बंद झाला. अम्लोडिपाइन चालू ठेवले.",

    // Reminders & Medicines
    "Medicine 1 (Pantoprazole 40mg)": "औषध 1 (पँटोप्राझोल 40mg)",
    "Medicine 2 (Telmisartan 40mg)": "औषध 2 (टेल्मिसार्टन 40mg)",
    "Medicine 3 (Aspirin 75mg)": "औषध 3 (ॲस्पिरिन 75mg)",
    "Medicine 4 (Multivitamin & Zinc)": "औषध 4 (मल्टीव्हिटॅमिन आणि झिंक)",
    "Medicine 5 (Calcium + Vitamin D3)": "औषध 5 (कॅल्शियम + व्हिटॅमिन D3)",
    "Medicine B (Amlodipine 5mg)": "औषध B (अम्लोडिपाइन 5mg)",
    "Medicine 7 (Atorvastatin 10mg)": "औषध 7 (अटोर्वास्टॅटिन 10mg)",
    "Before Breakfast": "नाश्त्यापूर्वी",
    "After Breakfast": "नाश्त्यानंतर",
    "After Lunch": "दुपारच्या जेवणानंतर",
    "Evening Snack": "संध्याकाळच्या स्नॅक्ससोबत",
    "After Dinner · Before Bed": "रात्रीच्या जेवणानंतर · झोपण्यापूर्वी",
    "Before Sleep": "झोपण्यापूर्वी",
    "Take on empty stomach 30 mins before breakfast with plain water.":
      "नाश्त्यापूर्वी 30 मिनिटे रिकाम्या पोटी साध्या पाण्यासोबत घ्या.",
    "Doctor A prescribed for blood pressure control. Take after breakfast.":
      "डॉक्टर A ने रक्तदाब नियंत्रणासाठी लिहून दिले. नाश्त्यानंतर घ्या.",
    "Take with full glass of water after breakfast. Antiplatelet preventive care.":
      "नाश्त्यानंतर पूर्ण ग्लास पाण्यासोबत घ्या. प्रतिबंधात्मक काळजी.",
    "Immunity and metabolic support. Take after lunch.":
      "रोगप्रतिकारशक्ती आणि चयापचय सहाय्य. दुपारच्या जेवणानंतर घ्या.",
    "Bone health and daily supplement. Take after light evening snack.":
      "हाडांचे आरोग्य आणि दैनंदिन पूरक. संध्याकाळच्या हलक्या स्नॅक्सनंतर घ्या.",
    "Doctor B prescribed for evening blood pressure stability. Take consistently at 9:00 PM.":
      "डॉक्टर B ने संध्याकाळच्या रक्तदाबाच्या स्थिरतेसाठी लिहून दिले. रात्री 9:00 वाजता नियमितपणे घ्या.",
    "Lipid and cholesterol management. Best absorbed during nighttime rest.":
      "लिपिड आणि कोलेस्टेरॉल व्यवस्थापन. रात्रीच्या विश्रांतीदरम्यान उत्तम प्रकारे शोषले जाते.",

    // Names & Specialities
    "Dr. Rajesh Verma": "डॉ. राजेश वर्मा",
    "Dr. Meena Kapoor": "डॉ. मीना कपूर",
    "Aarav Sharma": "आरव शर्मा",
    "Internal Medicine — MBBS, MD": "इंटरनल मेडिसिन — MBBS, MD",
    "Cardiology — MBBS, MD, DM (Cardiology)": "कार्डिओलॉजी — MBBS, MD, DM (कार्डिओलॉजी)",
    "Apollo Hospital, New Delhi": "अपोलो रुग्णालय, नवी दिल्ली",
    "AIIMS, New Delhi": "एम्स रुग्णालय, नवी दिल्ली",
    "14 years": "14 वर्षे",
    "19 years": "19 वर्षे",
    "1 tablet": "1 गोळी",
    "Ongoing": "चालू आहे",
    "30 days": "30 दिवस"
  }
};

/* ─────────────────────────────────────────────
   LANGUAGE FUNCTIONS & HELPERS
───────────────────────────────────────────── */
var currentLang = localStorage.getItem("medtrace_lang") || "en";

function t(key, fallback) {
  if (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key] !== undefined) {
    return TRANSLATIONS[currentLang][key];
  }
  if (TRANSLATIONS["en"] && TRANSLATIONS["en"][key] !== undefined) {
    return TRANSLATIONS["en"][key];
  }
  return fallback !== undefined ? fallback : key;
}

function translateOutcome(o) {
  if (!o) return "";
  var s = String(o).trim();
  var low = s.toLowerCase();
  if (currentLang === "hi") {
    if (low.includes("improv")) return "सुधार हुआ";
    if (low.includes("worsen")) return "बिगड़ गया";
    if (low.includes("mixed")) return "मिश्रित";
    if (low.includes("no change") || low.includes("nochange")) return "कोई बदलाव नहीं";
  } else if (currentLang === "mr") {
    if (low.includes("improv")) return "सुधारणा झाली";
    if (low.includes("worsen")) return "बिघडले";
    if (low.includes("mixed")) return "मिश्र";
    if (low.includes("no change") || low.includes("nochange")) return "बदल नाही";
  }
  return s;
}

function translateSchedule(sch) {
  if (!sch || currentLang === "en") return sch;
  var res = String(sch);
  if (currentLang === "hi") {
    res = res.replace(/Morning/gi, "सुबह")
      .replace(/Night/gi, "रात")
      .replace(/Afternoon/gi, "दोपहर")
      .replace(/Evening/gi, "शाम")
      .replace(/\(after food\)/gi, "(खाने के बाद)")
      .replace(/\(before food\)/gi, "(खाने से पहले)")
      .replace(/once daily/gi, "दिन में एक बार")
      .replace(/twice daily/gi, "दिन में दो बार")
      .replace(/30 days/gi, "30 दिन")
      .replace(/Ongoing/gi, "चल रही है");
  } else if (currentLang === "mr") {
    res = res.replace(/Morning/gi, "सकाळ")
      .replace(/Night/gi, "रात्र")
      .replace(/Afternoon/gi, "दुपार")
      .replace(/Evening/gi, "संध्याकाळ")
      .replace(/\(after food\)/gi, "(जेवणानंतर)")
      .replace(/\(before food\)/gi, "(जेवणापूर्वी)")
      .replace(/once daily/gi, "दिवसातून एकदा")
      .replace(/twice daily/gi, "दिवसातून दोनदा")
      .replace(/30 days/gi, "30 दिवस")
      .replace(/Ongoing/gi, "चालू आहे");
  }
  return res;
}

function translateClinical(text) {
  if (!text || currentLang === "en") return text;
  var tStr = String(text).trim();
  if (CLINICAL_TRANSLATIONS[currentLang] && CLINICAL_TRANSLATIONS[currentLang][tStr]) {
    return CLINICAL_TRANSLATIONS[currentLang][tStr];
  }
  var dict = CLINICAL_TRANSLATIONS[currentLang] || {};
  for (var k in dict) {
    if (k.length > 8 && tStr.indexOf(k) !== -1) {
      tStr = tStr.split(k).join(dict[k]);
    }
  }
  return tStr;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("medtrace_lang", lang);

  // Update topbar lang button display
  const flags = { en: "🇬🇧", hi: "🇮🇳", mr: "🇮🇳" };
  const labels = { en: "EN", hi: "हिंदी", mr: "मराठी" };
  const flagEl = document.getElementById("langFlag");
  const labelEl = document.getElementById("langLabel");
  if (flagEl) flagEl.textContent = flags[lang];
  if (labelEl) labelEl.textContent = labels[lang];

  // Update login lang button display
  const loginFlagEl = document.getElementById("loginLangFlag");
  const loginLabelEl = document.getElementById("loginLangLabel");
  if (loginFlagEl) loginFlagEl.textContent = flags[lang];
  if (loginLabelEl) loginLabelEl.textContent = labels[lang];

  // Update active state in both dropdown menus
  document.querySelectorAll(".lang-option").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });

  closeLangMenu();
  closeLoginLangMenu();

  // Update all data-i18n elements (HTML or text)
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (val !== undefined && val !== null) {
      if (typeof val === "string" && val.includes("<") && val.includes(">")) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });

  // Update all data-i18n-ph elements (placeholders)
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.getAttribute("data-i18n-ph");
    const val = t(key);
    if (val) el.placeholder = val;
  });

  // Re-render all dynamic content
  if (session && session.loggedIn) {
    renderAll();
  }

  showToast(
    lang === "hi" ? "✅ भाषा हिंदी में बदली गई" :
      lang === "mr" ? "✅ भाषा मराठीत बदलली" :
        "✅ Language set to English"
    , "success");
}

function toggleLangMenu() {
  const menu = document.getElementById("langMenu");
  const btn = document.getElementById("langBtn");
  if (!menu || !btn) return;
  const isOpen = !menu.classList.contains("hidden");
  if (isOpen) {
    menu.classList.add("hidden");
    btn.classList.remove("open");
  } else {
    menu.classList.remove("hidden");
    btn.classList.add("open");
  }
}

function closeLangMenu() {
  const menu = document.getElementById("langMenu");
  const btn = document.getElementById("langBtn");
  if (menu) menu.classList.add("hidden");
  if (btn) btn.classList.remove("open");
}

function toggleLoginLangMenu() {
  const menu = document.getElementById("loginLangMenu");
  const btn = document.getElementById("loginLangBtn");
  if (!menu || !btn) return;
  const isOpen = !menu.classList.contains("hidden");
  if (isOpen) {
    menu.classList.add("hidden");
    btn.classList.remove("open");
  } else {
    menu.classList.remove("hidden");
    btn.classList.add("open");
  }
}

function closeLoginLangMenu() {
  const menu = document.getElementById("loginLangMenu");
  const btn = document.getElementById("loginLangBtn");
  if (menu) menu.classList.add("hidden");
  if (btn) btn.classList.remove("open");
}

// Apply saved language, check Supabase session & initialize live backend connection on page load
document.addEventListener("DOMContentLoaded", () => {
  if (currentLang) setLanguage(currentLang);
  initSupabase();
  checkSupabaseSession();
  checkBackendConnection().then(() => syncFromBackend());
});

async function checkSupabaseSession() {
  if (!supabaseClient || !supabaseClient.auth) return;
  try {
    const { data: { session: existingSession } } = await supabaseClient.auth.getSession();
    if (existingSession && existingSession.user) {
      console.log("⚡ Active Supabase session detected:", existingSession.user.email);
      const email = (existingSession.user.email || "").toLowerCase();
      if (email.includes("doctora") || email.includes("dra")) {
        session.role = "doctorA";
      } else if (email.includes("doctorb") || email.includes("drb")) {
        session.role = "doctorB";
      } else {
        session.role = "patient";
      }
      session.loggedIn = true;
      session.supabaseUser = existingSession.user;
      startApp();
      showToast(`🎉 Welcome back! (Supabase: ${existingSession.user.email})`, "success");
    }
  } catch (err) {
    console.warn("Supabase session restore:", err);
  }
}

/* ═══════════════════════════════════════════════════════════
   PDF EXPORT — One-click Full Patient Report
═══════════════════════════════════════════════════════════ */

function exportPDF() {
  const p = appData.patient;
  const h = appData.history;
  const dA = appData.doctors.A;
  const dB = appData.doctors.B;
  const tl = appData.timeline;
  const now = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  // Build medicine table rows
  function medRows(meds) {
    if (!meds || meds.length === 0)
      return `<tr><td colspan="6" style="text-align:center;color:#6c7b8f;padding:16px">No medicines recorded</td></tr>`;
    return meds.map(m => `
      <tr>
        <td><strong>${m.name}</strong><br><small style="color:#6c7b8f">${m.dosage}</small></td>
        <td>${m.days}</td>
        <td>${m.schedule}</td>
        <td>${m.startDate}<br><small>→ ${m.endDate}</small></td>
        <td><span class="pdf-outcome ${outcomeClass(m.outcome)}">${m.outcome}</span></td>
        <td style="font-size:11px;color:#6c7b8f">${m.effectNote}</td>
      </tr>
    `).join("");
  }

  // Build timeline rows
  function timelineRows() {
    if (!tl || tl.length === 0) return "<p style='color:#6c7b8f'>No timeline entries.</p>";
    return tl.map(item => `
      <div class="pdf-timeline-item">
        <div class="pdf-timeline-dot"></div>
        <div>
          <div class="pdf-timeline-date">${item.date} · Doctor ${item.doctor}</div>
          <div class="pdf-timeline-title">${item.title}</div>
          <div class="pdf-timeline-desc">${item.desc}</div>
          <div style="margin-top:6px">
            <span class="pdf-outcome ${outcomeClass(item.outcome)}">${item.outcome}</span>
          </div>
        </div>
      </div>
    `).join("");
  }

  // Helper: resolve a fileData value to an absolute src usable in the popup window
  function resolveDocSrc(fileData) {
    if (!fileData) return null;
    // Already base64 data URI
    if (fileData.startsWith("data:image")) return fileData;
    // Relative filename — make absolute using current page origin + path
    if (fileData.endsWith(".jpg") || fileData.endsWith(".jpeg") || fileData.endsWith(".png") || fileData.endsWith(".webp") || fileData.endsWith(".gif")) {
      const base = window.location.href.replace(/\/[^/]*$/, "/");
      return base + fileData;
    }
    return null;
  }

  // Category icon & color map for PDF badges
  var CAT_STYLE = {
    xray: { icon: "🩻", label: "X-Ray", bg: "#e8f4ff", color: "#1d56a0" },
    blood: { icon: "🩸", label: "Blood Report", bg: "#fff0f0", color: "#c0392b" },
    mri: { icon: "🧠", label: "MRI / CT Scan", bg: "#f5f0ff", color: "#7c3aed" },
    prescription: { icon: "📄", label: "Prescription", bg: "#f0fff4", color: "#18875d" },
    other: { icon: "📋", label: "Medical Document", bg: "#fffbeb", color: "#b7791f" }
  };

  // Build uploaded documents section — shows actual images + metadata grid
  function docRows() {
    const docs = appData.documents || [];
    if (docs.length === 0) return "";

    const docCards = docs.map(d => {
      const cat = CAT_STYLE[d.category] || CAT_STYLE.other;
      const imgSrc = resolveDocSrc(d.fileData);
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${esc(d.title)}" class="pdf-scan-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : "";
      const fallbackHtml = `<div class="pdf-scan-fallback" ${imgSrc ? 'style="display:none"' : ""}>${cat.icon}<span>${esc(d.fileName || "Document")}</span></div>`;

      return `
        <div class="pdf-doc-card">
          <div class="pdf-doc-img-wrap">
            ${imgHtml}${fallbackHtml}
            <div class="pdf-doc-cat-badge" style="background:${cat.bg};color:${cat.color}">${cat.icon} ${cat.label}</div>
          </div>
          <div class="pdf-doc-body">
            <div class="pdf-doc-title">${esc(d.title)}</div>
            <div class="pdf-doc-meta">
              <span>📅 ${esc(d.date)}</span>
              <span style="color:#d1d5db">·</span>
              <span>🏥 ${esc(d.doctorOrLab || "Self")}</span>
            </div>
            ${d.journeyLabel ? `<div class="pdf-doc-journey">🔗 ${esc(d.journeyLabel)}</div>` : ""}
            <div class="pdf-doc-notes">${esc(d.notes || "No clinical notes recorded.")}</div>
            <div class="pdf-doc-file-chip">${esc(d.fileName || "")}${d.fileSize ? " · " + esc(d.fileSize) : ""}</div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="pdf-section">
        <div class="pdf-section-title">📁 Medical Reports, X-Rays &amp; Scans (${docs.length} documents)</div>
        <div class="pdf-doc-grid">
          ${docCards}
        </div>
      </div>
    `;
  }

  // History cards
  const histFields = [
    { label: t("histIllness"), value: h.illness, cls: "red" },
    { label: t("histSurgery"), value: h.surgery, cls: "amber" },
    { label: t("histAccident"), value: h.accident, cls: "" },
    { label: t("histAllergy"), value: h.allergy, cls: "purple" },
    { label: t("histFamily"), value: h.family, cls: "green" },
    { label: t("histOngoing"), value: h.ongoing, cls: "teal" },
  ];

  const histCards = histFields.map(f => `
    <div class="pdf-card ${f.cls}">
      <div class="pdf-card-label">${f.label}</div>
      <div class="pdf-card-value">${f.value || t("notDocumented")}</div>
    </div>
  `).join("");

  // Full HTML for the print popup
  const html = `<!DOCTYPE html>
<html lang="${currentLang === "en" ? "en" : "hi"}">
<head>
  <meta charset="UTF-8">
  <title>${t("pdfReportTitle")} — ${p.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      color: #172033;
      background: #fff;
      font-size: 13px;
      line-height: 1.6;
    }
    .pdf-print-page { max-width: 820px; margin: 0 auto; padding: 40px 36px; }
    .pdf-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid #1d56a0; padding-bottom: 20px; margin-bottom: 28px;
    }
    .pdf-brand { font-size: 26px; font-weight: 900; color: #1d56a0; letter-spacing: -0.5px; }
    .pdf-brand-sub { font-size: 12px; color: #6c7b8f; margin-top: 3px; }
    .pdf-meta { text-align: right; font-size: 12px; color: #6c7b8f; line-height: 1.8; }
    .pdf-title { font-size: 22px; font-weight: 900; color: #0d2545; margin-bottom: 4px; letter-spacing: -0.5px; }
    .pdf-subtitle { font-size: 12px; color: #6c7b8f; margin-bottom: 26px; padding-bottom: 16px; border-bottom: 1px solid #e0eaf4; }
    .pdf-section { margin-bottom: 28px; }
    .pdf-section-title {
      font-size: 11px; font-weight: 900; text-transform: uppercase;
      letter-spacing: 1.5px; color: #1d56a0;
      margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #e0eaf4;
    }
    .pdf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .pdf-info-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e0eaf4; font-size: 13px; }
    .pdf-info-label { color: #6c7b8f; font-weight: 500; }
    .pdf-info-value { font-weight: 700; color: #172033; }
    .pdf-card {
      background: #f8fbff; border: 1px solid #e0eaf4;
      border-radius: 10px; padding: 14px 16px; border-left: 4px solid #1d56a0;
    }
    .pdf-card.teal   { border-left-color: #13a7a0; }
    .pdf-card.red    { border-left-color: #e74c3c; }
    .pdf-card.amber  { border-left-color: #b7791f; }
    .pdf-card.purple { border-left-color: #8b5cf6; }
    .pdf-card.green  { border-left-color: #18875d; }
    .pdf-card-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #6c7b8f; margin-bottom: 5px; }
    .pdf-card-value { font-size: 13px; font-weight: 600; color: #172033; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #1d56a0; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 9px 10px; border-bottom: 1px solid #e0eaf4; vertical-align: top; }
    tr:nth-child(even) td { background: #f4f7fb; }
    .pdf-outcome { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 800; }
    .improved { background: #e8f7f1; color: #155e3a; }
    .worsened { background: #fdecea; color: #c0392b; }
    .nochange { background: #e0eef9; color: #1d56a0; }
    .mixed    { background: #fffbeb; color: #b7791f; }
    .pdf-timeline-item { display: flex; gap: 14px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #e0eaf4; }
    .pdf-timeline-dot { width: 12px; height: 12px; border-radius: 50%; background: #1d56a0; flex-shrink: 0; margin-top: 4px; }
    .pdf-timeline-date { font-size: 11px; font-weight: 700; color: #1d56a0; margin-bottom: 2px; }
    .pdf-timeline-title { font-size: 13px; font-weight: 800; color: #172033; margin-bottom: 3px; }
    .pdf-timeline-desc { font-size: 12px; color: #6c7b8f; }
    .pdf-footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #e0eaf4; font-size: 11px; color: #6c7b8f; display: flex; justify-content: space-between; }
    .pdf-disclaimer { background: #e0eef9; border: 1px solid #a8ccf0; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #1d56a0; margin-top: 16px; }
    .doctor-header { display: flex; align-items: center; gap: 12px; background: #f0f7ff; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; border: 1px solid #d4e9f7; }
    .doctor-avatar { width: 44px; height: 44px; border-radius: 10px; background: #1d56a0; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; flex-shrink: 0; }
    .doctor-avatar.teal { background: #13a7a0; }
    .doctor-info-name { font-size: 15px; font-weight: 800; color: #0d2545; }
    .doctor-info-spec { font-size: 12px; color: #6c7b8f; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .pdf-print-page { padding: 20px; }
      .pdf-section { page-break-inside: avoid; }
      .pdf-doc-card { page-break-inside: avoid; }
    }
    /* ── Medical Scan Image Cards ── */
    .pdf-doc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .pdf-doc-card {
      border: 1px solid #e0eaf4;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .pdf-doc-img-wrap {
      position: relative;
      width: 100%;
      height: 200px;
      background: #0b1528;
      overflow: hidden;
    }
    .pdf-scan-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .pdf-scan-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 40px;
      color: #94a3b8;
      background: #1e293b;
    }
    .pdf-scan-fallback span {
      font-size: 13px;
      color: #94a3b8;
    }
    .pdf-doc-cat-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .pdf-doc-body {
      padding: 12px 14px;
    }
    .pdf-doc-title {
      font-size: 13px;
      font-weight: 800;
      color: #0d2545;
      margin-bottom: 5px;
      line-height: 1.3;
    }
    .pdf-doc-meta {
      font-size: 11px;
      color: #6c7b8f;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 5px;
    }
    .pdf-doc-journey {
      font-size: 10px;
      font-weight: 700;
      color: #1d56a0;
      background: #e8f4ff;
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      margin-bottom: 6px;
    }
    .pdf-doc-notes {
      font-size: 11px;
      color: #4b5563;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .pdf-doc-file-chip {
      font-size: 10px;
      color: #94a3b8;
      background: #f1f5f9;
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
    }
  </style>
</head>
<body>
<div class="pdf-print-page">

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="text-align:right;margin-bottom:20px">
    <button onclick="window.print()" style="
      padding:10px 22px;border:none;border-radius:8px;
      background:#1d56a0;color:#fff;font-family:Inter,Arial,sans-serif;
      font-size:13px;font-weight:700;cursor:pointer;
      box-shadow:0 6px 18px rgba(29,86,160,.3)
    ">🖨️ Print / Save as PDF</button>
    <button onclick="window.close()" style="
      padding:10px 18px;border:1.5px solid #e0eaf4;border-radius:8px;
      background:#fff;color:#6c7b8f;font-family:Inter,Arial,sans-serif;
      font-size:13px;font-weight:700;cursor:pointer;margin-left:10px
    ">✕ Close</button>
  </div>

  <!-- Header -->
  <div class="pdf-header">
    <div>
      <div class="pdf-brand">⚕ MED-TRACE</div>
      <div class="pdf-brand-sub">Patient Treatment Journey & Outcome Intelligence</div>
    </div>
    <div class="pdf-meta">
      <strong>${t("pdfGenerated")}:</strong><br>
      ${now}<br>
      <strong>Patient ID:</strong> ${p.id}
    </div>
  </div>

  <div class="pdf-title">${t("pdfReportTitle")}</div>
  <div class="pdf-subtitle">${p.name} · ${p.age} ${currentLang === "mr" ? "वर्षे" : currentLang === "hi" ? "वर्ष" : "years"} · ${p.blood} · ${p.phone}</div>

  <!-- Patient Info -->
  <div class="pdf-section">
    <div class="pdf-section-title">${t("pdfPatientInfo")}</div>
    <div class="pdf-info-row"><span class="pdf-info-label">${currentLang === "hi" ? "पूरा नाम" : currentLang === "mr" ? "पूर्ण नाव" : "Full Name"}</span><span class="pdf-info-value">${p.name}</span></div>
    <div class="pdf-info-row"><span class="pdf-info-label">${currentLang === "hi" ? "आयु" : currentLang === "mr" ? "वय" : "Age"}</span><span class="pdf-info-value">${p.age} ${currentLang === "mr" ? "वर्षे" : currentLang === "hi" ? "वर्ष" : "years"}</span></div>
    <div class="pdf-info-row"><span class="pdf-info-label">${currentLang === "hi" ? "रक्त समूह" : currentLang === "mr" ? "रक्तगट" : "Blood Group"}</span><span class="pdf-info-value">${p.blood}</span></div>
    <div class="pdf-info-row"><span class="pdf-info-label">${currentLang === "hi" ? "फ़ोन" : currentLang === "mr" ? "फोन" : "Phone"}</span><span class="pdf-info-value">${p.phone}</span></div>
    <div class="pdf-info-row"><span class="pdf-info-label">${currentLang === "hi" ? "पता" : currentLang === "mr" ? "पत्ता" : "Address"}</span><span class="pdf-info-value">${p.address}</span></div>
    <div class="pdf-info-row"><span class="pdf-info-label">${currentLang === "hi" ? "आपातकालीन संपर्क" : currentLang === "mr" ? "आपत्कालीन संपर्क" : "Emergency Contact"}</span><span class="pdf-info-value">${p.emergencyContact}</span></div>
  </div>

  <!-- Medical History -->
  <div class="pdf-section">
    <div class="pdf-section-title">${t("pdfMedHistory")}</div>
    <div class="pdf-grid">${histCards}</div>
  </div>

  <!-- Doctor A -->
  <div class="pdf-section">
    <div class="pdf-section-title">${t("pdfDoctorA")}</div>
    <div class="doctor-header">
      <div class="doctor-avatar">A</div>
      <div>
        <div class="doctor-info-name">${dA.name}</div>
        <div class="doctor-info-spec">${dA.spec} · ${dA.hospital}</div>
      </div>
      <div style="margin-left:auto">
        <span class="pdf-outcome ${outcomeClass(dA.netOutcome)}">${dA.netOutcome}</span>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${currentLang === "hi" ? "दवाई" : currentLang === "mr" ? "औषध" : "Medicine"}</th>
          <th>${currentLang === "hi" ? "अवधि" : currentLang === "mr" ? "कालावधी" : "Duration"}</th>
          <th>${currentLang === "hi" ? "समय" : currentLang === "mr" ? "वेळ" : "Schedule"}</th>
          <th>${currentLang === "hi" ? "तारीख" : currentLang === "mr" ? "तारीख" : "Date"}</th>
          <th>${currentLang === "hi" ? "परिणाम" : currentLang === "mr" ? "निकाल" : "Outcome"}</th>
          <th>${currentLang === "hi" ? "प्रभाव नोट" : currentLang === "mr" ? "परिणाम नोंद" : "Effect Note"}</th>
        </tr>
      </thead>
      <tbody>${medRows(dA.meds)}</tbody>
    </table>
  </div>

  <!-- Doctor B -->
  <div class="pdf-section">
    <div class="pdf-section-title">${t("pdfDoctorB")}</div>
    <div class="doctor-header">
      <div class="doctor-avatar teal">B</div>
      <div>
        <div class="doctor-info-name">${dB.name}</div>
        <div class="doctor-info-spec">${dB.spec} · ${dB.hospital}</div>
      </div>
      <div style="margin-left:auto">
        <span class="pdf-outcome ${outcomeClass(dB.netOutcome)}">${dB.netOutcome}</span>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${currentLang === "hi" ? "दवाई" : currentLang === "mr" ? "औषध" : "Medicine"}</th>
          <th>${currentLang === "hi" ? "अवधि" : currentLang === "mr" ? "कालावधी" : "Duration"}</th>
          <th>${currentLang === "hi" ? "समय" : currentLang === "mr" ? "वेळ" : "Schedule"}</th>
          <th>${currentLang === "hi" ? "तारीख" : currentLang === "mr" ? "तारीख" : "Date"}</th>
          <th>${currentLang === "hi" ? "परिणाम" : currentLang === "mr" ? "निकाल" : "Outcome"}</th>
          <th>${currentLang === "hi" ? "प्रभाव नोट" : currentLang === "mr" ? "परिणाम नोंद" : "Effect Note"}</th>
        </tr>
      </thead>
      <tbody>${medRows(dB.meds)}</tbody>
    </table>
  </div>

  <!-- Timeline -->
  <div class="pdf-section">
    <div class="pdf-section-title">${t("pdfTimeline")}</div>
    ${timelineRows()}
  </div>

  <!-- Attached Medical Documents & Scans -->
  ${docRows()}

  <!-- Disclaimer -->
  <div class="pdf-disclaimer">
    ℹ ${t("pdfDisclaimer")}
  </div>

  <!-- Footer -->
  <div class="pdf-footer">
    <span>⚕ MED-TRACE — Patient Treatment Journey</span>
    <span>${t("pdfGenerated")}: ${now}</span>
  </div>

</div>
</body>
</html>`;

  // Open in new window and trigger print dialog
  const win = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!win) {
    showToast(
      currentLang === "hi" ? "❌ पॉपअप ब्लॉक है। कृपया पॉपअप की अनुमति दें।" :
        currentLang === "mr" ? "❌ पॉपअप ब्लॉक आहे. कृपया पॉपअप परवानगी द्या." :
          "❌ Popup blocked. Please allow popups for this page."
      , "error");
    return;
  }
  win.document.write(html);
  win.document.close();

  showToast(
    currentLang === "hi" ? "📄 PDF रिपोर्ट खुल रही है..." :
      currentLang === "mr" ? "📄 PDF अहवाल उघडत आहे..." :
        "📄 PDF report opened! Use Print → Save as PDF."
    , "success");
}

