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

// Start Server
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`⚕️  MED-TRACE API Server running on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`========================================`);
});
