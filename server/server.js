const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed origins for CORS (Vercel deployment + Local development)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8085',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8085',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Allow Vercel preview & production URLs automatically
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// --- Realistic Clinical In-Memory Data Store ---
let appState = {
  patient: {
    id: "PAT-001",
    name: "Aarav Sharma",
    age: 32,
    gender: "Male",
    bloodGroup: "B+",
    phone: "9876543210",
    email: "aarav.sharma@example.com",
    address: "402, Green Meadows, MG Road, Pune, Maharashtra 411001",
    emergencyContact: {
      name: "Pooja Sharma",
      relation: "Spouse",
      phone: "+91 98765 43211"
    },
    allergies: [
      { allergen: "Penicillin", severity: "High / Anaphylaxis Risk", date: "2018-04-12" }
    ],
    vitals: {
      bp: "128/84 mmHg",
      pulse: "74 bpm",
      spO2: "99%",
      weight: "68 kg"
    }
  },
  doctors: {
    A: {
      id: "DR-A",
      name: "Dr. Rajesh Verma",
      specialization: "Internal Medicine & Cardiology",
      degrees: "MBBS, MD (Medicine)",
      hospital: "Apollo Spectra Hospitals",
      experience: "14 Years",
      phone: "9811122233"
    },
    B: {
      id: "DR-B",
      name: "Dr. Meena Kapoor",
      specialization: "Neurology",
      degrees: "MBBS, DM (Neurology)",
      hospital: "Max Super Speciality Hospital",
      experience: "11 Years",
      phone: "9822233344"
    }
  },
  medicines: [
    {
      id: "MED-001",
      name: "Telmisartan",
      genericName: "Telmisartan Tablets IP",
      dosage: "40mg",
      frequency: "Once Daily",
      timing: "Morning (8:00 AM) after breakfast",
      doctor: "DR-A",
      doctorName: "Dr. Rajesh Verma",
      startDate: "2024-01-10",
      status: "Active",
      outcome: "Positive — BP normalized to 128/84 mmHg without dizziness."
    },
    {
      id: "MED-002",
      name: "Metoprolol Succinate",
      genericName: "Metoprolol PR Tablets",
      dosage: "25mg",
      frequency: "Once Daily",
      timing: "Night (9:30 PM)",
      doctor: "DR-A",
      doctorName: "Dr. Rajesh Verma",
      startDate: "2024-01-10",
      status: "Active",
      outcome: "Positive — Resting pulse controlled at 72–76 bpm."
    },
    {
      id: "MED-003",
      name: "Amitriptyline",
      genericName: "Amitriptyline Hydrochloride",
      dosage: "10mg",
      frequency: "Once Daily",
      timing: "Night (9:30 PM)",
      doctor: "DR-B",
      doctorName: "Dr. Meena Kapoor",
      startDate: "2024-03-02",
      status: "Active",
      outcome: "Under Review — Migraine aura frequency reduced from 4/week to 1/week."
    }
  ],
  orders: [
    {
      id: "ORD-9281",
      patientId: "PAT-001",
      items: [
        { name: "Telmisartan 40mg", qty: 2, price: 110 },
        { name: "Metoprolol 25mg", qty: 1, price: 85 }
      ],
      totalAmount: 305,
      deliveryAddress: "402, Green Meadows, Pune",
      paymentMethod: "UPI",
      status: "Delivered",
      timeline: ["Order Placed", "Confirmed", "Preparing", "Out for Delivery", "Delivered"],
      orderDate: "2024-03-15T09:30:00Z"
    }
  ],
  reminders: [
    { id: "REM-1", medicineName: "Telmisartan 40mg", time: "08:00", slot: "Morning", enabled: true },
    { id: "REM-2", medicineName: "Metoprolol 25mg", time: "21:30", slot: "Night", enabled: true },
    { id: "REM-3", medicineName: "Amitriptyline 10mg", time: "21:30", slot: "Night", enabled: true }
  ]
};

// --- Routes ---

// Root / Home page for API status check in browser
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>MED-TRACE API Server</title></head>
      <body style="font-family: system-ui, sans-serif; background: #0b1329; color: #f0f4ff; padding: 40px; text-align: center;">
        <h1 style="color: #38bdf8;">⚕️ MED-TRACE Backend API is Live</h1>
        <p style="color: #94a3b8;">Clinical Continuity Engine & Patient Journey Platform</p>
        <p><a href="/api/health" style="color: #34d399; font-weight: bold; text-decoration: none;">View Health Endpoint &rarr;</a></p>
      </body>
    </html>
  `);
});

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'MED-TRACE Core API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. Authentication Mock Route
app.post('/api/auth/login', (req, res) => {
  const { role, id, password } = req.body;
  if (role === 'patient' && id === 'PAT-001' && password === 'patient123') {
    return res.json({ success: true, role: 'patient', user: appState.patient });
  }
  if (role === 'doctor') {
    if (id === 'DR-A' && password === 'docA123') {
      return res.json({ success: true, role: 'doctor', user: appState.doctors.A });
    }
    if (id === 'DR-B' && password === 'docB123') {
      return res.json({ success: true, role: 'doctor', user: appState.doctors.B });
    }
  }
  res.status(401).json({ success: false, message: 'Invalid credentials. Use demo pills on login page.' });
});

// 3. Patient Record
app.get('/api/patient', (req, res) => {
  res.json({ success: true, data: appState.patient });
});

app.put('/api/patient', (req, res) => {
  appState.patient = { ...appState.patient, ...req.body };
  res.json({ success: true, message: 'Patient profile updated', data: appState.patient });
});

// 4. Doctors Information
app.get('/api/doctors', (req, res) => {
  res.json({ success: true, data: appState.doctors });
});

// 5. Prescriptions / Medicines
app.get('/api/medicines', (req, res) => {
  const { doctor, status } = req.query;
  let filtered = appState.medicines;
  if (doctor) filtered = filtered.filter(m => m.doctor === doctor);
  if (status) filtered = filtered.filter(m => m.status === status);
  res.json({ success: true, count: filtered.length, data: filtered });
});

app.post('/api/medicines', (req, res) => {
  const { name, dosage, frequency, timing, doctor, doctorName, outcome } = req.body;
  if (!name || !dosage) {
    return res.status(400).json({ success: false, message: 'Medicine name and dosage are required' });
  }
  const newMedicine = {
    id: `MED-${Date.now()}`,
    name,
    genericName: req.body.genericName || name,
    dosage,
    frequency: frequency || 'Once Daily',
    timing: timing || 'Morning',
    doctor: doctor || 'DR-A',
    doctorName: doctorName || 'Attending Physician',
    startDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    outcome: outcome || 'Initial prescription logged.'
  };
  appState.medicines.unshift(newMedicine);
  res.status(201).json({ success: true, message: 'Medicine prescribed successfully', data: newMedicine });
});

// 6. Clinical Handover Synthesis
app.get('/api/handover', (req, res) => {
  const drAMeds = appState.medicines.filter(m => m.doctor === 'DR-A');
  const drBMeds = appState.medicines.filter(m => m.doctor === 'DR-B');
  res.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      patient: appState.patient,
      fromDoctor: appState.doctors.A,
      toDoctor: appState.doctors.B,
      activeDrugsUnderA: drAMeds,
      activeDrugsUnderB: drBMeds,
      criticalAllergies: appState.patient.allergies,
      recommendedNextSteps: "Assess cranial nerve response, review migraine aura frequency, monitor BP stability."
    }
  });
});

// 7. Pharmacy Orders
app.get('/api/orders', (req, res) => {
  res.json({ success: true, count: appState.orders.length, data: appState.orders });
});

app.post('/api/orders', (req, res) => {
  const { items, deliveryAddress, paymentMethod, totalAmount } = req.body;
  const newOrder = {
    id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    patientId: 'PAT-001',
    items: items || [],
    totalAmount: totalAmount || 0,
    deliveryAddress: deliveryAddress || appState.patient.address,
    paymentMethod: paymentMethod || 'UPI',
    status: 'Order Placed',
    timeline: ['Order Placed'],
    orderDate: new Date().toISOString()
  };
  appState.orders.unshift(newOrder);
  res.status(201).json({ success: true, message: 'Order placed with pharmacy', data: newOrder });
});

// 8. Reminders
app.get('/api/reminders', (req, res) => {
  res.json({ success: true, data: appState.reminders });
});

app.post('/api/reminders', (req, res) => {
  const newReminder = {
    id: `REM-${Date.now()}`,
    medicineName: req.body.medicineName,
    time: req.body.time || "08:00",
    slot: req.body.slot || "Morning",
    enabled: true
  };
  appState.reminders.push(newReminder);
  res.status(201).json({ success: true, data: newReminder });
});

// ─── 9. Doctor Reviews ─────────────────────────────────────────────────────

// In-memory doctor_reviews table:
// { review_id, doctor_id, patient_id, appointment_id, rating, review_text, status, created_at, updated_at }
let doctorReviews = [
  {
    review_id: "REV-001",
    doctor_id: "DR-A",
    patient_id: "PAT-001",
    appointment_id: "APT-2024-001",
    rating: 5,
    review_text: "Dr. Verma took the time to explain the rationale for switching from Losartan to Telmisartan. My BP is now completely under control.",
    status: "approved",
    author_name: "Aarav S.",
    verified: true,
    created_at: "2024-06-15T10:30:00Z",
    updated_at: "2024-06-15T10:30:00Z"
  },
  {
    review_id: "REV-002",
    doctor_id: "DR-A",
    patient_id: "PAT-002",
    appointment_id: "APT-2024-002",
    rating: 5,
    review_text: "Very attentive physician. Does not rush through consultations and provides clear lifestyle advice alongside medication.",
    status: "approved",
    author_name: "Sunita M.",
    verified: true,
    created_at: "2024-03-20T09:00:00Z",
    updated_at: "2024-03-20T09:00:00Z"
  },
  {
    review_id: "REV-003",
    doctor_id: "DR-A",
    patient_id: "PAT-003",
    appointment_id: "APT-2024-003",
    rating: 4,
    review_text: "Excellent diagnostic acumen and warm bedside manner. Highly recommended for chronic hypertension management.",
    status: "approved",
    author_name: "Ramesh K.",
    verified: true,
    created_at: "2024-01-10T11:00:00Z",
    updated_at: "2024-01-10T11:00:00Z"
  },
  {
    review_id: "REV-004",
    doctor_id: "DR-B",
    patient_id: "PAT-001",
    appointment_id: "APT-2024-004",
    rating: 5,
    review_text: "Dr. Meena Kapoor diagnosed my calcium-channel tolerance accurately. Switching to Amlodipine stabilized my night readings immediately.",
    status: "approved",
    author_name: "Aarav S.",
    verified: true,
    created_at: "2024-08-12T14:00:00Z",
    updated_at: "2024-08-12T14:00:00Z"
  },
  {
    review_id: "REV-005",
    doctor_id: "DR-B",
    patient_id: "PAT-004",
    appointment_id: "APT-2024-005",
    rating: 5,
    review_text: "One of the most knowledgeable and compassionate cardiologists. She explains ECG and echocardiogram reports in plain language.",
    status: "approved",
    author_name: "Priya R.",
    verified: true,
    created_at: "2024-05-08T10:00:00Z",
    updated_at: "2024-05-08T10:00:00Z"
  },
  {
    review_id: "REV-006",
    doctor_id: "DR-B",
    patient_id: "PAT-005",
    appointment_id: "APT-2024-006",
    rating: 5,
    review_text: "Top tier care. Her preventive strategy helped normalize my cholesterol and blood pressure without over-medication.",
    status: "approved",
    author_name: "Vikram N.",
    verified: true,
    created_at: "2024-02-14T16:00:00Z",
    updated_at: "2024-02-14T16:00:00Z"
  }
];

// Verified completed appointments (eligibility pool)
const verifiedAppointments = [
  { appointment_id: "APT-2024-001", patient_id: "PAT-001", doctor_id: "DR-A", status: "completed", date: "2024-06-10" },
  { appointment_id: "APT-2024-004", patient_id: "PAT-001", doctor_id: "DR-B", status: "completed", date: "2024-08-05" },
  // Any logged-in patient can also submit via the "current treatment" appointment
  { appointment_id: "APT-CURRENT-A", patient_id: "PAT-001", doctor_id: "DR-A", status: "completed", date: "2024-07-16" },
  { appointment_id: "APT-CURRENT-B", patient_id: "PAT-001", doctor_id: "DR-B", status: "completed", date: "2024-09-01" }
];

function computeRatingSummary(doctorId) {
  const approved = doctorReviews.filter(r => r.doctor_id === doctorId && r.status === 'approved');
  if (approved.length === 0) return { average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  const total = approved.length;
  const sum = approved.reduce((acc, r) => acc + r.rating, 0);
  const average = Math.round((sum / total) * 10) / 10;
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  approved.forEach(r => { breakdown[r.rating] = (breakdown[r.rating] || 0) + 1; });
  // Convert to percentages
  const breakdownPct = {};
  [5, 4, 3, 2, 1].forEach(s => { breakdownPct[s] = Math.round((breakdown[s] / total) * 100); });
  return { average, total, breakdown: breakdownPct };
}

// POST /api/reviews — Submit a new review
app.post('/api/reviews', (req, res) => {
  const { doctor_id, patient_id, appointment_id, rating, review_text, author_name } = req.body;

  if (!doctor_id || !patient_id || !rating || !review_text) {
    return res.status(400).json({ success: false, message: 'doctor_id, patient_id, rating, and review_text are required.' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  }
  if (!review_text.trim() || review_text.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Review text must be at least 10 characters.' });
  }

  // Eligibility: must have a completed appointment with this doctor
  const eligible = verifiedAppointments.some(
    a => a.patient_id === patient_id && a.doctor_id === doctor_id && a.status === 'completed'
  );
  if (!eligible) {
    return res.status(403).json({ success: false, message: 'You must have a completed appointment with this doctor to submit a review.' });
  }

  // Duplicate prevention: one review per appointment
  if (appointment_id) {
    const dup = doctorReviews.find(r => r.appointment_id === appointment_id && r.patient_id === patient_id);
    if (dup) {
      return res.status(409).json({ success: false, message: 'You have already submitted a review for this appointment.' });
    }
  }

  const newReview = {
    review_id: `REV-${Date.now()}`,
    doctor_id,
    patient_id,
    appointment_id: appointment_id || `APT-${Date.now()}`,
    rating: parseInt(rating),
    review_text: review_text.trim(),
    status: 'approved',
    author_name: author_name || 'Patient',
    verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  doctorReviews.unshift(newReview);
  res.status(201).json({ success: true, message: 'Review submitted successfully.', data: newReview, summary: computeRatingSummary(doctor_id) });
});

// GET /api/doctors/:id/reviews — Fetch all approved reviews for a doctor
app.get('/api/doctors/:id/reviews', (req, res) => {
  const doctorId = req.params.id;
  const reviews = doctorReviews
    .filter(r => r.doctor_id === doctorId && r.status === 'approved')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, count: reviews.length, data: reviews });
});

// GET /api/doctors/:id/ratings — Fetch rating summary for a doctor
app.get('/api/doctors/:id/ratings', (req, res) => {
  const doctorId = req.params.id;
  const summary = computeRatingSummary(doctorId);
  res.json({ success: true, data: summary });
});

// GET /api/reviews/eligibility — Check if patient can review a doctor
app.get('/api/reviews/eligibility', (req, res) => {
  const { patient_id, doctor_id } = req.query;
  if (!patient_id || !doctor_id) {
    return res.status(400).json({ success: false, message: 'patient_id and doctor_id required.' });
  }
  const eligible = verifiedAppointments.some(
    a => a.patient_id === patient_id && a.doctor_id === doctor_id && a.status === 'completed'
  );
  const existingReview = doctorReviews.find(
    r => r.patient_id === patient_id && r.doctor_id === doctor_id && r.status !== 'deleted'
  );
  res.json({
    success: true,
    data: {
      eligible,
      hasExistingReview: !!existingReview,
      existingReview: existingReview || null
    }
  });
});

// PUT /api/reviews/:id — Edit own review
app.put('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  const { patient_id, rating, review_text } = req.body;
  const review = doctorReviews.find(r => r.review_id === id);

  if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
  if (review.patient_id !== patient_id) return res.status(403).json({ success: false, message: 'You can only edit your own reviews.' });
  if (rating && (rating < 1 || rating > 5)) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  if (review_text && review_text.trim().length < 10) return res.status(400).json({ success: false, message: 'Review text must be at least 10 characters.' });

  if (rating) review.rating = parseInt(rating);
  if (review_text) review.review_text = review_text.trim();
  review.updated_at = new Date().toISOString();

  res.json({ success: true, message: 'Review updated.', data: review, summary: computeRatingSummary(review.doctor_id) });
});

// DELETE /api/reviews/:id — Delete own review
app.delete('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  const { patient_id } = req.body;
  const idx = doctorReviews.findIndex(r => r.review_id === id);

  if (idx === -1) return res.status(404).json({ success: false, message: 'Review not found.' });
  if (doctorReviews[idx].patient_id !== patient_id) return res.status(403).json({ success: false, message: 'You can only delete your own reviews.' });

  const doctorId = doctorReviews[idx].doctor_id;
  doctorReviews.splice(idx, 1);
  res.json({ success: true, message: 'Review deleted.', summary: computeRatingSummary(doctorId) });
});

// Start Server
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`⚕️  MED-TRACE API Server running on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`========================================`);
});
