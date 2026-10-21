/* ═══════════════════════════════════════════════════════════
   MED-TRACE — Advanced Features Module
   1. Doctor Handover Mode
   2. Current Status Card (Doctor Dashboard)
   3. Important History Detector
   4. Scan → Connect to Journey
   5. Ask My History (Patient AI chat)
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   FEATURE 1: DOCTOR HANDOVER MODE
   One click → full structured patient briefing for a new doctor
───────────────────────────────────────────────────────────── */

function openHandoverMode() {
  const d      = appData;
  const p      = d.patient;
  const dA     = d.doctors.A;
  const dB     = d.doctors.B;
  const hist   = d.history;
  const tl     = d.timeline || [];
  const docs   = d.documents || [];

  // Build all medicines across doctors
  const allMeds = [
    ...dA.meds.map(m => ({ ...m, doctorKey: "A", doctorName: dA.name })),
    ...dB.meds.map(m => ({ ...m, doctorKey: "B", doctorName: dB.name }))
  ];

  // Current treatment = most recent ongoing med
  const ongoingMed = allMeds.find(m => (m.endDate || "").toLowerCase() === "ongoing")
    || allMeds[allMeds.length - 1];

  // Pending / Missing info detector
  const flags = detectImportantItems();

  // Build structured handover HTML
  const html = `
    <div class="handover-report" id="handoverReport">

      <!-- Header -->
      <div class="handover-header">
        <div class="handover-header-left">
          <div class="handover-brand">🩺 MED-TRACE — Doctor Handover Report</div>
          <div class="handover-patient-name">${esc(p.name)}</div>
          <div class="handover-patient-meta">
            ${p.id} · ${p.age} yrs · Blood ${p.blood} · ${p.gender}
          </div>
        </div>
        <div class="handover-header-right">
          <div class="handover-date">Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
          <div class="handover-actions-bar" style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end">
            <button class="btn-handover-print" onclick="window.print()" style="padding:6px 14px;font-size:12px;font-weight:700;background:var(--blue-600);color:#ffffff;border:none;border-radius:9999px;cursor:pointer;box-shadow:0 2px 6px rgba(26,68,128,0.25);">🖨️ Print / Save PDF</button>
          </div>
          <div class="handover-print-note">For internal handover use only</div>
        </div>
      </div>

      <!-- Progress flow -->
      <div class="handover-flow-bar">
        ${["Patient Overview","Diagnosis & Disease","Previous Treatments","Medicine + Duration","Follow-up Results","Report Changes","Treatment Changes","Current Status"].map((s,i) => `
          <div class="handover-flow-step">
            <div class="handover-flow-num">${i+1}</div>
            <div class="handover-flow-label">${s}</div>
          </div>
          ${i < 7 ? '<div class="handover-flow-arrow">→</div>' : ""}
        `).join("")}
      </div>

      <!-- Step 1: Patient Overview -->
      <div class="handover-section">
        <div class="handover-section-num">1</div>
        <div class="handover-section-body">
          <div class="handover-section-title">PATIENT OVERVIEW</div>
          <div class="handover-grid-2">
            ${[
              ["Full Name", p.name],
              ["Age / Gender", `${p.age} years, ${p.gender}`],
              ["Blood Group", p.blood],
              ["Contact", p.phone],
              ["Patient ID", p.id],
              ["Address", p.address || "—"]
            ].map(([l,v]) => `<div class="handover-field"><span class="handover-field-label">${l}</span><span class="handover-field-value">${esc(v || "—")}</span></div>`).join("")}
          </div>
        </div>
      </div>

      <!-- Step 2: Diagnosis & Disease -->
      <div class="handover-section">
        <div class="handover-section-num">2</div>
        <div class="handover-section-body">
          <div class="handover-section-title">DIAGNOSIS & DISEASE</div>
          <div class="handover-grid-2">
            ${[
              ["Reason for Consultation (Doctor A)", dA.meds[0] ? dA.meds[0].reason : "Not documented"],
              ["Reason for Consultation (Doctor B)", dB.meds[0] ? dB.meds[0].reason : "Not documented"],
              ["Past Illness / Condition", hist.illness],
              ["Surgeries / Procedures", hist.surgery],
              ["Accidents / Trauma", hist.accident],
              ["Known Allergies", hist.allergy],
              ["Family History", hist.family]
            ].map(([l,v]) => `<div class="handover-field"><span class="handover-field-label">${l}</span><span class="handover-field-value">${esc(v || "Not documented")}</span></div>`).join("")}
          </div>
        </div>
      </div>

      <!-- Step 3: Previous Treatments -->
      <div class="handover-section">
        <div class="handover-section-num">3</div>
        <div class="handover-section-body">
          <div class="handover-section-title">PREVIOUS TREATMENTS</div>
          ${["A","B"].map(key => {
            const doc = d.doctors[key];
            return `
              <div class="handover-doctor-block">
                <div class="handover-doctor-label">${key === "A" ? "👨‍⚕️" : "👩‍⚕️"} ${esc(doc.name)} — ${esc(doc.spec)}</div>
                <div class="handover-doctor-meta">${esc(doc.hospital)} · ${esc(doc.experience)} experience</div>
                <span class="handover-outcome-badge ${outcomeClass(doc.netOutcome)}">${outcomeIcon(doc.netOutcome)} Net: ${translateOutcome(doc.netOutcome)}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Step 4: Medicine + Duration -->
      <div class="handover-section">
        <div class="handover-section-num">4</div>
        <div class="handover-section-body">
          <div class="handover-section-title">MEDICINE + DURATION</div>
          <table class="handover-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Duration</th>
                <th>Schedule</th>
                <th>Doctor</th>
                <th>Period</th>
              </tr>
            </thead>
            <tbody>
              ${allMeds.map(m => `
                <tr>
                  <td><strong>${esc(m.name)}</strong></td>
                  <td>${esc(m.dosage || "—")}</td>
                  <td>${esc(m.days || "—")}</td>
                  <td>${esc(m.schedule || "—")}</td>
                  <td>${esc(m.doctorName)}</td>
                  <td>${esc(m.startDate)} → ${esc(m.endDate)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Step 5: Follow-up Results -->
      <div class="handover-section">
        <div class="handover-section-num">5</div>
        <div class="handover-section-body">
          <div class="handover-section-title">FOLLOW-UP RESULTS</div>
          ${allMeds.map(m => `
            <div class="handover-followup-row">
              <div class="handover-followup-med">
                <strong>${esc(m.name)}</strong>
                <span class="handover-outcome-badge ${outcomeClass(m.outcome)}">${outcomeIcon(m.outcome)} ${translateOutcome(m.outcome)}</span>
              </div>
              <div class="handover-followup-note">${esc(m.effectNote || "No effect note documented.")}</div>
              ${m.followupDate ? `<div class="handover-followup-date">📅 Follow-up: ${esc(m.followupDate)}</div>` : ""}
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Step 6: Report Changes -->
      <div class="handover-section">
        <div class="handover-section-num">6</div>
        <div class="handover-section-body">
          <div class="handover-section-title">REPORT CHANGES</div>
          <div class="handover-timeline-mini">
            ${tl.map(tItem => `
              <div class="handover-tl-item">
                <div class="handover-tl-dot ${outcomeClass(tItem.outcome)}"></div>
                <div>
                  <div class="handover-tl-date">${esc(tItem.date)} · Doctor ${esc(tItem.doctor)}</div>
                  <div class="handover-tl-title">${esc(tItem.title)}</div>
                  <div class="handover-tl-desc">${esc(tItem.desc)}</div>
                </div>
                <span class="handover-outcome-badge ${outcomeClass(tItem.outcome)}" style="margin-left:auto;flex-shrink:0">${outcomeIcon(tItem.outcome)} ${translateOutcome(tItem.outcome)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <!-- Step 7: Treatment Changes -->
      <div class="handover-section">
        <div class="handover-section-num">7</div>
        <div class="handover-section-body">
          <div class="handover-section-title">TREATMENT CHANGES</div>
          <div class="handover-changes-list">
            ${allMeds.length >= 2 ? allMeds.slice(0, -1).map((m, i) => {
              const next = allMeds[i + 1];
              return `
                <div class="handover-change-row">
                  <div class="handover-change-from">
                    <div class="handover-change-label">Previous</div>
                    <div class="handover-change-med">${esc(m.name)} (${esc(m.doctorName)})</div>
                    <span class="handover-outcome-badge ${outcomeClass(m.outcome)}">${outcomeIcon(m.outcome)} ${translateOutcome(m.outcome)}</span>
                  </div>
                  <div class="handover-change-arrow">→</div>
                  <div class="handover-change-to">
                    <div class="handover-change-label">Changed To</div>
                    <div class="handover-change-med">${esc(next.name)} (${esc(next.doctorName)})</div>
                    <span class="handover-outcome-badge ${outcomeClass(next.outcome)}">${outcomeIcon(next.outcome)} ${translateOutcome(next.outcome)}</span>
                  </div>
                </div>
              `;
            }).join("") : `<div class="handover-empty">No treatment changes documented.</div>`}
          </div>
        </div>
      </div>

      <!-- Step 8: Current Status -->
      <div class="handover-section handover-section-highlight">
        <div class="handover-section-num accent">8</div>
        <div class="handover-section-body">
          <div class="handover-section-title">CURRENT STATUS</div>
          <div class="handover-status-card">
            <div class="handover-status-row">🟢 <strong>Current treatment:</strong> ${esc(ongoingMed ? ongoingMed.name : hist.ongoing || "Not documented")}</div>
            <div class="handover-status-row">📅 <strong>Started:</strong> ${esc(ongoingMed ? ongoingMed.startDate : "—")}</div>
            <div class="handover-status-row">🔄 <strong>Next follow-up:</strong> ${esc(ongoingMed ? ongoingMed.followupDate || "Not scheduled" : "—")}</div>
            <div class="handover-status-row">📄 <strong>Latest report:</strong> ${docs.length > 0 ? esc(docs[0].date) + " — " + esc(docs[0].title) : "No reports uploaded"}</div>
            <div class="handover-status-row">💊 <strong>Current schedule:</strong> ${esc(ongoingMed ? ongoingMed.schedule : "—")}</div>
            <div class="handover-status-row">🏥 <strong>Current doctor:</strong> ${esc(ongoingMed ? ongoingMed.doctorName : "—")}</div>
          </div>
        </div>
      </div>

      <!-- Footer note -->
      <div class="handover-footer-note">
        ℹ This handover report was generated from documented records only. MED-TRACE does not make diagnoses or clinical recommendations.
        All content reflects patient-recorded and doctor-recorded information.
      </div>

    </div>
  `;

  // Open in large modal
  const mc = document.getElementById("modalCard");
  if (mc) mc.classList.add("modal-handover");
  openModal("🩺 Doctor Handover Report", html);
}

/* ─────────────────────────────────────────────────────────────
   FEATURE 2: CURRENT STATUS CARD
   Shown on doctor dashboard when a doctor is logged in
───────────────────────────────────────────────────────────── */

function renderCurrentStatusCard() {
  const el = document.getElementById("currentStatusCard");
  if (!el) return;

  if (!isDoctor()) {
    el.classList.add("hidden");
    return;
  }

  el.classList.remove("hidden");

  const d    = appData;
  const dA   = d.doctors.A;
  const dB   = d.doctors.B;
  const docs  = d.documents || [];

  const allMeds = [
    ...dA.meds.map(m => ({ ...m, doctorKey: "A", doctorName: dA.name })),
    ...dB.meds.map(m => ({ ...m, doctorKey: "B", doctorName: dB.name }))
  ];

  const ongoingMed = allMeds.find(m => (m.endDate || "").toLowerCase() === "ongoing")
    || allMeds[allMeds.length - 1];

  const flags = detectImportantItems();
  const latestDoc = docs.length > 0 ? docs[0] : null;

  el.innerHTML = `
    <div class="status-card-header">
      <div class="status-card-eyebrow">CURRENT TREATMENT STATUS</div>
      <button class="btn-handover-launch" onclick="openHandoverMode()">
        🩺 Start Handover View
      </button>
    </div>
    <div class="status-card-body">
      <div class="status-row">
        <span class="status-dot status-dot-green"></span>
        <span class="status-label">Current treatment:</span>
        <span class="status-value">${esc(ongoingMed ? ongoingMed.name : d.history.ongoing || "Not documented")}</span>
      </div>
      <div class="status-row">
        <span class="status-icon-sm">📅</span>
        <span class="status-label">Started:</span>
        <span class="status-value">${esc(ongoingMed ? ongoingMed.startDate : "—")}</span>
      </div>
      <div class="status-row">
        <span class="status-icon-sm">🔄</span>
        <span class="status-label">Next follow-up:</span>
        <span class="status-value">${esc(ongoingMed ? ongoingMed.followupDate || "Not scheduled" : "—")}</span>
      </div>
      <div class="status-row">
        <span class="status-icon-sm">📄</span>
        <span class="status-label">Latest report:</span>
        <span class="status-value">${latestDoc ? esc(latestDoc.date) + " — " + esc(latestDoc.title) : "No reports uploaded"}</span>
      </div>
      ${flags.length > 0 ? `
        <div class="status-row status-row-warn">
          <span class="status-icon-sm">⚠</span>
          <span class="status-label">Pending information:</span>
          <span class="status-value status-warn">${flags.length} item${flags.length > 1 ? "s" : ""} requiring review</span>
        </div>
      ` : `
        <div class="status-row status-row-ok">
          <span class="status-icon-sm">✅</span>
          <span class="status-label">Record status:</span>
          <span class="status-value status-ok">All records appear complete</span>
        </div>
      `}
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────
   FEATURE 3: IMPORTANT HISTORY DETECTOR
   Surfaces records that may need review when a doctor opens a patient
───────────────────────────────────────────────────────────── */

function detectImportantItems() {
  const flags = [];
  const d = appData;
  const hist = d.history;
  const allMeds = [
    ...d.doctors.A.meds,
    ...d.doctors.B.meds
  ];

  // Check: any medicine with Worsened outcome
  const worsenedMeds = allMeds.filter(m => m.outcome === "Worsened");
  worsenedMeds.forEach(m => {
    flags.push({
      title: "Previous treatment change",
      desc: `${m.name} showed documented outcome: ${m.outcome}. Treatment was changed after follow-up.`
    });
  });

  // Check: missing follow-up dates
  const noFollowup = allMeds.filter(m => !m.followupDate);
  if (noFollowup.length > 0) {
    flags.push({
      title: "Follow-up information unavailable",
      desc: `${noFollowup.length} medicine(s) have no follow-up date documented: ${noFollowup.map(m => m.name).join(", ")}.`
    });
  }

  // Check: allergy documented
  if (hist.allergy && hist.allergy.toLowerCase() !== "none" && hist.allergy.toLowerCase() !== "no known allergy") {
    flags.push({
      title: "Previously documented reaction",
      desc: `Allergy on record: ${hist.allergy}. Review before prescribing.`
    });
  }

  // Check: no documents uploaded
  if (!d.documents || d.documents.length === 0) {
    flags.push({
      title: "No reports or scans uploaded",
      desc: "No medical documents have been uploaded. Reports may be required for complete assessment."
    });
  }

  // Check: mixed net outcome for any doctor
  ["A", "B"].forEach(key => {
    if (d.doctors[key].netOutcome === "Mixed") {
      flags.push({
        title: `Mixed documented results — ${d.doctors[key].name}`,
        desc: `Patient showed mixed outcomes under ${d.doctors[key].name}. Review individual medicine records.`
      });
    }
  });

  return flags;
}

function renderImportantHistoryAlert() {
  const el = document.getElementById("importantHistoryAlert");
  if (!el) return;

  if (!isDoctor()) {
    el.classList.add("hidden");
    return;
  }

  const flags = detectImportantItems();
  if (flags.length === 0) {
    el.classList.add("hidden");
    return;
  }

  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="iha-header" onclick="toggleIHADetails()" id="ihaHeader">
      <div class="iha-header-left">
        <div class="iha-icon">⚠</div>
        <div>
          <div class="iha-title">${flags.length} item${flags.length > 1 ? "s" : ""} may require review</div>
          <div class="iha-sub">Documented records that may need attention before consultation</div>
        </div>
      </div>
      <div class="iha-chevron" id="ihaChevron">▾</div>
    </div>
    <div class="iha-details hidden" id="ihaDetails">
      <div class="iha-disclaimer">These are documented records only — not diagnoses or clinical predictions.</div>
      ${flags.map(f => `
        <div class="iha-item">
          <div class="iha-bullet">•</div>
          <div>
            <div class="iha-item-title">${esc(f.title)}</div>
            <div class="iha-item-desc">${esc(f.desc)}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function toggleIHADetails() {
  const details = document.getElementById("ihaDetails");
  const chevron = document.getElementById("ihaChevron");
  if (!details) return;
  const isHidden = details.classList.contains("hidden");
  details.classList.toggle("hidden", !isHidden);
  if (chevron) chevron.textContent = isHidden ? "▴" : "▾";
}

/* ─────────────────────────────────────────────────────────────
   FEATURE 4: SCAN → CONNECT TO JOURNEY
   Asks the patient where in the treatment timeline a new scan belongs
───────────────────────────────────────────────────────────── */

function openUploadDocModalWithJourney(defaultCategory) {
  // Build treatment phase options from all medicines
  const allMeds = [
    ...appData.doctors.A.meds.map(m => ({ ...m, doctorKey: "A", doctorName: appData.doctors.A.name })),
    ...appData.doctors.B.meds.map(m => ({ ...m, doctorKey: "B", doctorName: appData.doctors.B.name }))
  ];

  pendingDocUpload = null;
  const today = new Date().toISOString().split("T")[0];
  const cat = defaultCategory || "blood";

  openModal("📷 Upload & Connect to Journey", `
    <!-- Step 1: File -->
    <div class="upload-journey-step" id="ujStep1">
      <div class="upload-step-header">
        <div class="upload-step-num">1</div>
        <div class="upload-step-title">Select Report or Scan</div>
      </div>
      <div class="dropzone-area" id="up_dropzone" onclick="document.getElementById('up_fileInput').click()"
        ondragover="handleDocDragOver(event)" ondragleave="handleDocDragLeave(event)" ondrop="handleDocDrop(event)">
        <input type="file" id="up_fileInput" accept="image/*,application/pdf" style="display:none" onchange="handleDocFileSelect(event)">
        <div class="dropzone-icon">📁</div>
        <div class="dropzone-title">Click to browse or drag & drop photo / report</div>
        <div class="dropzone-sub">Supports JPG, PNG, WEBP, PDF (Max 15MB)</div>
      </div>
      <div id="up_previewWrap" style="display:none"></div>
    </div>

    <!-- Step 2: Details -->
    <div class="upload-journey-step" style="margin-top:16px">
      <div class="upload-step-header">
        <div class="upload-step-num">2</div>
        <div class="upload-step-title">Report Details</div>
      </div>
      <div class="form-group">
        <label>Document Category</label>
        <select id="up_category" class="form-select">
          <option value="xray" ${cat === "xray" ? "selected" : ""}>🩻 X-Ray</option>
          <option value="blood" ${cat === "blood" ? "selected" : ""}>🩸 Blood Report</option>
          <option value="mri" ${cat === "mri" ? "selected" : ""}>🧠 MRI / CT Scan</option>
          <option value="prescription" ${cat === "prescription" ? "selected" : ""}>📄 Prescription</option>
          <option value="other" ${cat === "other" ? "selected" : ""}>📋 Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Report / Test Title *</label>
        <input id="up_title" placeholder="e.g. Blood Report, Chest X-Ray">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Lab / Hospital / Doctor</label>
          <input id="up_doctorOrLab" placeholder="e.g. Apollo Hospital">
        </div>
        <div class="form-group">
          <label>Report Date</label>
          <input id="up_date" type="date" value="${today}">
        </div>
      </div>
      <div class="form-group">
        <label>Clinical Notes / Findings</label>
        <textarea id="up_notes" rows="2" placeholder="Key findings, values, observations..."></textarea>
      </div>
    </div>

    <!-- Step 3: Connect to Journey -->
    <div class="upload-journey-step" style="margin-top:16px">
      <div class="upload-step-header">
        <div class="upload-step-num">3</div>
        <div class="upload-step-title">Where should this report be placed in the treatment journey?</div>
      </div>
      <div class="journey-connect-options">
        <label class="journey-option">
          <input type="radio" name="journeyPhase" value="before_all" checked>
          <div class="journey-option-card">
            <div class="journey-option-icon">📋</div>
            <div class="journey-option-label">Before any treatment</div>
            <div class="journey-option-sub">Baseline / diagnostic report</div>
          </div>
        </label>
        ${allMeds.map(m => `
          <label class="journey-option">
            <input type="radio" name="journeyPhase" value="during_${m.id}">
            <div class="journey-option-card">
              <div class="journey-option-icon">💊</div>
              <div class="journey-option-label">During ${esc(m.name)}</div>
              <div class="journey-option-sub">${esc(m.startDate)} → ${esc(m.endDate)} · ${esc(m.doctorName)}</div>
            </div>
          </label>
          <label class="journey-option">
            <input type="radio" name="journeyPhase" value="after_${m.id}">
            <div class="journey-option-card">
              <div class="journey-option-icon">📊</div>
              <div class="journey-option-label">After ${esc(m.name)}</div>
              <div class="journey-option-sub">Follow-up result for this medicine</div>
            </div>
          </label>
        `).join("")}
        <label class="journey-option">
          <input type="radio" name="journeyPhase" value="current">
          <div class="journey-option-card">
            <div class="journey-option-icon">🟢</div>
            <div class="journey-option-label">Current treatment</div>
            <div class="journey-option-sub">Related to ongoing treatment</div>
          </div>
        </label>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-top:20px">
      <button class="btn-save" style="flex:1" onclick="saveUploadedDocWithJourney()">💾 Save & Connect to Journey</button>
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
    </div>
  `);
}

function saveUploadedDocWithJourney() {
  const title = document.getElementById("up_title") ? document.getElementById("up_title").value.trim() : "";
  const journeyRadio = document.querySelector('input[name="journeyPhase"]:checked');
  const journeyPhase = journeyRadio ? journeyRadio.value : "before_all";

  if (!title && !pendingDocUpload) {
    showToast("Please select a file or enter a report title.", "error");
    return;
  }

  const category = document.getElementById("up_category") ? document.getElementById("up_category").value : "other";
  const doctorOrLab = document.getElementById("up_doctorOrLab") ? document.getElementById("up_doctorOrLab").value.trim() : "";
  const date = document.getElementById("up_date") ? document.getElementById("up_date").value : new Date().toISOString().split("T")[0];
  const notes = document.getElementById("up_notes") ? document.getElementById("up_notes").value.trim() : "";

  let fileData = "", fileName = "", fileSize = "1.2 MB", fileType = "image/png";
  if (pendingDocUpload) {
    fileData = pendingDocUpload.fileData;
    fileName = pendingDocUpload.fileName;
    fileSize = pendingDocUpload.fileSize;
    fileType = pendingDocUpload.fileType;
  } else {
    fileName = (title || "report").toLowerCase().replace(/\s+/g, "_") + ".png";
    fileData = createDocPlaceholderSVG(category, title);
  }

  // Build a human-readable journey label
  let journeyLabel = "General Record";
  if (journeyPhase === "before_all") journeyLabel = "Before Treatment";
  else if (journeyPhase === "current") journeyLabel = "Current Treatment";
  else {
    const allMeds = [...appData.doctors.A.meds, ...appData.doctors.B.meds];
    const [phase, medId] = journeyPhase.split("_", 2);
    const medActual = allMeds.find(m => m.id === medId);
    if (medActual) {
      journeyLabel = (phase === "during" ? "During " : "After ") + medActual.name;
    }
  }

  const newDoc = {
    id: "doc_" + Date.now(),
    title: title || "Medical Document",
    category,
    date,
    doctorOrLab: doctorOrLab || "Self Upload",
    notes,
    fileData,
    fileName,
    fileSize,
    fileType,
    journeyPhase,
    journeyLabel,
    uploadedBy: session.role === "patient" ? (appData.patient.name || "Patient")
      : (session.role === "doctorA" ? appData.doctors.A.name : appData.doctors.B.name),
    uploadedAt: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  };

  if (!appData.documents) appData.documents = [];
  appData.documents.unshift(newDoc);
  saveData();
  closeModal();
  renderRecords();
  renderRecordsBadge();
  renderNavBadges();
  showToast(`✅ Document saved & connected: ${journeyLabel}`, "success");
}

/* Override the default openUploadDocModal to use journey-connect version */
function openUploadDocModal(defaultCategory) {
  openUploadDocModalWithJourney(defaultCategory);
}

/* ─────────────────────────────────────────────────────────────
   FEATURE 5: ASK MY HISTORY (Patient record query)
   Patient can ask questions about their own documented records
───────────────────────────────────────────────────────────── */

function openAskMyHistory() {
  openModal("🔍 Ask About Your Documented History", `
    <div class="ask-history-container">
      <div class="ask-history-intro">
        <div class="ask-history-intro-icon">🔍</div>
        <p class="ask-history-intro-text">
          Ask questions about your documented medical records. This feature answers only
          from your recorded information — it does not provide medical advice.
        </p>
      </div>

      <div class="ask-history-examples">
        <div class="ask-examples-label">Try asking:</div>
        <div class="ask-example-chips">
          <button class="ask-example-chip" onclick="askHistoryQuery('When did my current treatment start?')">When did my current treatment start?</button>
          <button class="ask-example-chip" onclick="askHistoryQuery('What treatments were documented before this one?')">What treatments were documented before this one?</button>
          <button class="ask-example-chip" onclick="askHistoryQuery('When was my last follow-up?')">When was my last follow-up?</button>
          <button class="ask-example-chip" onclick="askHistoryQuery('Which reports were uploaded after my previous treatment?')">Which reports were uploaded after previous treatment?</button>
          <button class="ask-example-chip" onclick="askHistoryQuery('What are my documented allergies?')">What are my documented allergies?</button>
          <button class="ask-example-chip" onclick="askHistoryQuery('How many medicines have I been prescribed?')">How many medicines prescribed?</button>
          <button class="ask-example-chip" onclick="askHistoryQuery('What medicines improved my condition?')">What medicines improved my condition?</button>
          <button class="ask-example-chip" onclick="askHistoryQuery('List all my uploaded reports')">List all my uploaded reports</button>
        </div>
      </div>

      <div class="ask-history-input-row">
        <input id="askHistoryInput" class="ask-history-input" type="text"
          placeholder="Ask about your documented history..."
          onkeydown="if(event.key==='Enter') submitAskHistory()">
        <button class="ask-history-btn" onclick="submitAskHistory()">Ask →</button>
      </div>

      <div id="askHistoryAnswer" class="ask-history-answer hidden"></div>

      <div class="ask-history-disclaimer">
        ℹ Answers are based solely on your documented records. This is not medical advice.
      </div>
    </div>
  `);
}

function askHistoryQuery(q) {
  const input = document.getElementById("askHistoryInput");
  if (input) input.value = q;
  submitAskHistory();
}

function submitAskHistory() {
  const input = document.getElementById("askHistoryInput");
  const answerEl = document.getElementById("askHistoryAnswer");
  if (!input || !answerEl) return;

  const q = input.value.trim().toLowerCase();
  if (!q) {
    showToast("Please enter a question.", "error");
    return;
  }

  const answer = generateHistoryAnswer(q);
  answerEl.classList.remove("hidden");
  answerEl.innerHTML = `
    <div class="ask-answer-query">❓ "${esc(input.value.trim())}"</div>
    <div class="ask-answer-body">${answer}</div>
  `;
}

function generateHistoryAnswer(q) {
  const d = appData;
  const p = d.patient;
  const hist = d.history;
  const dA = d.doctors.A;
  const dB = d.doctors.B;
  const docs = d.documents || [];
  const tl = d.timeline || [];

  const allMeds = [
    ...dA.meds.map(m => ({ ...m, doctorKey: "A", doctorName: dA.name })),
    ...dB.meds.map(m => ({ ...m, doctorKey: "B", doctorName: dB.name }))
  ];

  const ongoingMed = allMeds.find(m => (m.endDate || "").toLowerCase() === "ongoing")
    || allMeds[allMeds.length - 1];

  // ── Match questions ──

  if (q.includes("current treatment") && (q.includes("start") || q.includes("when") || q.includes("began"))) {
    if (!ongoingMed) return answerBox("No current treatment is documented in your records.");
    return answerBox(`
      Your current treatment is <strong>${esc(ongoingMed.name)}</strong>, prescribed by ${esc(ongoingMed.doctorName)}.
      <br>It was started on <strong>${esc(ongoingMed.startDate)}</strong>.
      <br>Schedule: ${esc(ongoingMed.schedule || "—")}.
    `);
  }

  if (q.includes("current treatment") || (q.includes("current") && q.includes("medicine"))) {
    if (!ongoingMed) return answerBox("No current treatment is documented in your records.");
    return answerBox(`
      Your current documented treatment is <strong>${esc(ongoingMed.name)}</strong>
      (${esc(ongoingMed.dosage || ongoingMed.days || "—")}) prescribed by ${esc(ongoingMed.doctorName)}.
      <br>Started: ${esc(ongoingMed.startDate)}.
    `);
  }

  if ((q.includes("before") && (q.includes("treatment") || q.includes("medicine"))) || q.includes("previous treatment") || q.includes("previous medicine")) {
    const prev = allMeds.slice(0, -1);
    if (prev.length === 0) return answerBox("No previous treatments are documented before your current one.");
    return answerBox(`
      <strong>${prev.length}</strong> previous treatment(s) are documented before your current one:
      <ul>
        ${prev.map(m => `<li><strong>${esc(m.name)}</strong> (${esc(m.days || "—")}) — ${esc(m.doctorName)} · Outcome: ${translateOutcome(m.outcome)}</li>`).join("")}
      </ul>
    `);
  }

  if (q.includes("last follow") || q.includes("follow-up") || q.includes("followup")) {
    const medsWithFollowup = allMeds.filter(m => m.followupDate);
    if (medsWithFollowup.length === 0) return answerBox("No follow-up dates are documented in your records.");
    const latest = medsWithFollowup[medsWithFollowup.length - 1];
    return answerBox(`
      Your last documented follow-up was on <strong>${esc(latest.followupDate)}</strong>,
      for <strong>${esc(latest.name)}</strong> prescribed by ${esc(latest.doctorName)}.
    `);
  }

  if ((q.includes("report") || q.includes("scan") || q.includes("document")) && (q.includes("after") || q.includes("previous") || q.includes("upload"))) {
    if (docs.length === 0) return answerBox("No reports or scans have been uploaded to your records yet.");
    const journeyDocs = docs.filter(d => d.journeyLabel && !d.journeyLabel.includes("Before") && !d.journeyLabel.includes("General"));
    if (journeyDocs.length === 0) return answerBox("No reports are specifically connected to a treatment phase yet. You can connect reports using the Upload section.");
    return answerBox(`
      <strong>${journeyDocs.length}</strong> report(s) are connected to treatment phases:
      <ul>
        ${journeyDocs.map(doc => `<li><strong>${esc(doc.title)}</strong> — ${esc(doc.journeyLabel || "—")} · ${esc(doc.date)}</li>`).join("")}
      </ul>
    `);
  }

  if (q.includes("allerg")) {
    const al = hist.allergy;
    if (!al || al.toLowerCase().includes("none") || al.toLowerCase().includes("no known")) {
      return answerBox("No known allergies are documented in your records.");
    }
    return answerBox(`Your documented allergy is: <strong>${esc(al)}</strong>`);
  }

  if (q.includes("how many") && (q.includes("medicine") || q.includes("prescription"))) {
    return answerBox(`
      <strong>${allMeds.length}</strong> medicine(s) have been documented across both doctors:
      <ul>
        <li>${dA.name}: ${dA.meds.map(m => m.name).join(", ") || "None"}</li>
        <li>${dB.name}: ${dB.meds.map(m => m.name).join(", ") || "None"}</li>
      </ul>
    `);
  }

  if (q.includes("improved") || q.includes("worked") || q.includes("effective")) {
    const improved = allMeds.filter(m => m.outcome === "Improved");
    if (improved.length === 0) return answerBox("No medicines with documented 'Improved' outcome are on record.");
    return answerBox(`
      <strong>${improved.length}</strong> medicine(s) have documented improved outcomes:
      <ul>
        ${improved.map(m => `<li><strong>${esc(m.name)}</strong> (${esc(m.doctorName)}) — ${esc(m.effectNote ? m.effectNote.substring(0, 80) + "..." : "No notes")}</li>`).join("")}
      </ul>
    `);
  }

  if (q.includes("list") && (q.includes("report") || q.includes("scan") || q.includes("document"))) {
    if (docs.length === 0) return answerBox("No reports or scans have been uploaded yet.");
    return answerBox(`
      <strong>${docs.length}</strong> document(s) on record:
      <ul>
        ${docs.map(doc => `<li><strong>${esc(doc.title)}</strong> — ${esc(doc.date)} · ${esc(doc.doctorOrLab || "—")} ${doc.journeyLabel ? "· " + esc(doc.journeyLabel) : ""}</li>`).join("")}
      </ul>
    `);
  }

  if (q.includes("doctor") && (q.includes("who") || q.includes("which") || q.includes("name"))) {
    return answerBox(`
      Two doctors are documented in your records:
      <ul>
        <li><strong>${esc(dA.name)}</strong> — ${esc(dA.spec)} (${esc(dA.hospital)})</li>
        <li><strong>${esc(dB.name)}</strong> — ${esc(dB.spec)} (${esc(dB.hospital)})</li>
      </ul>
    `);
  }

  if (q.includes("blood group") || q.includes("blood type")) {
    return answerBox(`Your documented blood group is <strong>${esc(p.blood)}</strong>.`);
  }

  if (q.includes("age") || q.includes("years old")) {
    return answerBox(`Your documented age is <strong>${p.age} years</strong>.`);
  }

  if (q.includes("surgery") || q.includes("operation") || q.includes("procedure")) {
    return answerBox(`Documented surgical history: <strong>${esc(hist.surgery || "None documented")}</strong>`);
  }

  if (q.includes("illness") || q.includes("condition") || q.includes("diagnos")) {
    return answerBox(`Documented past illness / chronic condition: <strong>${esc(hist.illness || "None documented")}</strong>`);
  }

  if (q.includes("timeline") || q.includes("history") || q.includes("journey")) {
    if (tl.length === 0) return answerBox("No timeline entries are documented yet.");
    return answerBox(`
      Your treatment journey has <strong>${tl.length}</strong> documented events:
      <ul>
        ${tl.map(e => `<li><strong>${esc(e.date)}</strong> — ${esc(e.title)}</li>`).join("")}
      </ul>
    `);
  }

  // Default fallback
  return `
    <div class="ask-no-match">
      <div class="ask-no-match-icon">🔍</div>
      <div>I could not find a matching record for that question. Try asking about:</div>
      <ul style="margin:8px 0 0 0;padding-left:20px;font-size:13px;color:var(--ink-muted)">
        <li>Your current or previous treatments</li>
        <li>Follow-up dates</li>
        <li>Uploaded reports</li>
        <li>Allergies, illness, or surgery history</li>
        <li>Medicines that improved or did not improve your condition</li>
      </ul>
    </div>
  `;
}

function answerBox(html) {
  return `<div class="ask-answer-result">${html}</div>`;
}

/* ─────────────────────────────────────────────────────────────
   HOOK INTO RENDER PIPELINE
   Inject features into the existing renderDashboard flow
───────────────────────────────────────────────────────────── */

// Initialize seed medical documents with journey connections if empty
var SEED_DOC_VERSION = 3; // increment to force re-seed
function initSeedDocumentsWithJourney() {
  if (typeof appData === "undefined") return;
  var savedVersion = parseInt(localStorage.getItem("medtrace_seed_doc_version") || "0", 10);
  var needsReset = !appData.documents || appData.documents.length === 0 || savedVersion < SEED_DOC_VERSION;
  if (needsReset) {
    localStorage.setItem("medtrace_seed_doc_version", String(SEED_DOC_VERSION));
    appData.documents = [
      {
        id: "doc_seed_1",
        title: "Chest X-Ray (PA View)",
        category: "xray",
        date: "2024-05-10",
        doctorOrLab: "Apex Diagnostic Centre, New Delhi",
        notes: "Baseline diagnostic scan before initiating antihypertensive therapy. Normal cardiac silhouette. No pleural effusion or consolidation noted.",
        fileName: "med_chest_xray.jpg",
        fileSize: "606 KB",
        fileType: "image/jpeg",
        fileData: "med_chest_xray.jpg",
        journeyPhase: "before_all",
        journeyLabel: "Before Treatment (Baseline)",
        uploadedBy: "Dr. Rajesh Verma",
        uploadedAt: "10 May 2024"
      },
      {
        id: "doc_seed_2",
        title: "CBC & Metabolic Blood Panel Report",
        category: "blood",
        date: "2024-06-12",
        doctorOrLab: "Apollo Diagnostics, New Delhi",
        notes: "Complete Blood Count report. Hemoglobin: 13.1 g/dL (slightly low). WBC: 7.2 × 10³/µL (normal). Platelets: 265 × 10³/µL (normal). Haematocrit: 39.5%.",
        fileName: "med_blood_report.jpg",
        fileSize: "680 KB",
        fileType: "image/jpeg",
        fileData: "med_blood_report.jpg",
        journeyPhase: "after_mA1",
        journeyLabel: "After Losartan 50mg (Follow-up)",
        uploadedBy: "Dr. Rajesh Verma",
        uploadedAt: "12 Jun 2024"
      },
      {
        id: "doc_seed_3",
        title: "Brain MRI — Axial T2 (9 Slices)",
        category: "mri",
        date: "2024-07-20",
        doctorOrLab: "City Medical Imaging, New Delhi",
        notes: "MRI brain without contrast. No acute infarct or mass lesion. Ventricles normal in size and configuration. White matter signal normal.",
        fileName: "med_mri_brain.jpg",
        fileSize: "802 KB",
        fileType: "image/jpeg",
        fileData: "med_mri_brain.jpg",
        journeyPhase: "mid_treatment",
        journeyLabel: "During Neurological Review",
        uploadedBy: "Dr. Sneha Patel",
        uploadedAt: "20 Jul 2024"
      },
      {
        id: "doc_seed_4",
        title: "12-Lead ECG Report",
        category: "other",
        date: "2024-08-05",
        doctorOrLab: "St. Mary's Hospital Cardiology Dept.",
        notes: "Normal sinus rhythm. Heart rate 72 bpm. PR interval 160 ms, QRS duration 90 ms, QT/QTc 380/410 ms. P-R-T Axes: 60, 45, 70. Normal ECG.",
        fileName: "med_ecg_report.jpg",
        fileSize: "893 KB",
        fileType: "image/jpeg",
        fileData: "med_ecg_report.jpg",
        journeyPhase: "cardiac_monitor",
        journeyLabel: "Cardiac Monitoring Phase",
        uploadedBy: "Dr. A. Smith, MD",
        uploadedAt: "05 Aug 2024"
      },
      {
        id: "doc_seed_5",
        title: "Knee X-Ray — AP & Lateral Views",
        category: "xray",
        date: "2024-09-15",
        doctorOrLab: "Fortis Bone & Joint Institute",
        notes: "Both AP and lateral views of right knee. Normal joint space. No bony fractures or erosions. Mild degenerative changes noted at medial compartment. Follow-up in 3 months.",
        fileName: "med_knee_xray.jpg",
        fileSize: "601 KB",
        fileType: "image/jpeg",
        fileData: "med_knee_xray.jpg",
        journeyPhase: "ortho_eval",
        journeyLabel: "Orthopaedic Evaluation",
        uploadedBy: "Dr. Meena Kapoor",
        uploadedAt: "15 Sep 2024"
      },
      {
        id: "doc_seed_6",
        title: "Doctor Prescription — Cardiology",
        category: "prescription",
        date: "2024-05-10",
        doctorOrLab: "Dr. Rajesh Verma, Apollo Hospital Delhi",
        notes: "Prescription: Tab. Losartan 50mg (morning), Tab. Amlodipine 5mg (night), Tab. Aspirin 75mg (afternoon). Dietary advice: avoid salty food. Monitor BP twice weekly.",
        fileName: "med_prescription.jpg",
        fileSize: "792 KB",
        fileType: "image/jpeg",
        fileData: "med_prescription.jpg",
        journeyPhase: "before_all",
        journeyLabel: "Initial Consultation",
        uploadedBy: "Dr. Rajesh Verma",
        uploadedAt: "10 May 2024"
      }
    ];
    if (typeof saveData === "function") saveData();
  }
}

// Enhance renderRecords to display journey badges
const _origRenderRecords = typeof renderRecords === "function" ? renderRecords : null;
window.renderRecords = function(filter) {
  const currentFilter = filter || (typeof currentDocFilter !== "undefined" ? currentDocFilter : "all");
  if (_origRenderRecords) _origRenderRecords(currentFilter);
  
  const grid = document.getElementById("recordsGrid");
  if (!grid) return;
  
  const cards = grid.querySelectorAll(".record-card");
  const docs = appData.documents || [];
  const filtered = currentFilter === "all" ? docs : docs.filter(d => d.category === currentFilter);
  
  cards.forEach((card, idx) => {
    const doc = filtered[idx];
    if (doc && doc.journeyLabel && !card.querySelector(".record-journey-badge")) {
      const meta = card.querySelector(".record-card-meta");
      if (meta) {
        const badge = document.createElement("div");
        badge.className = "record-journey-badge";
        badge.innerHTML = `🔗 ${esc(doc.journeyLabel)}`;
        meta.parentNode.insertBefore(badge, meta.nextSibling);
      }
    }
  });
};

// Patch renderDashboard to also render our new components
const _origRenderDashboard = typeof renderDashboard === "function" ? renderDashboard : null;
window.renderDashboard = function() {
  if (_origRenderDashboard) _origRenderDashboard();
  setTimeout(() => {
    renderCurrentStatusCard();
    renderImportantHistoryAlert();
  }, 0);
};

// Also patch showSection to refresh cards when switching to dashboard
const _origShowSection = typeof showSection === "function" ? showSection : null;
window.showSection = function(id, btn) {
  if (_origShowSection) _origShowSection(id, btn);
  if (id === "dashboard") {
    setTimeout(() => {
      renderCurrentStatusCard();
      renderImportantHistoryAlert();
    }, 50);
  }
};

// Patch startApp to initialize documents and render features
const _origStartApp = typeof startApp === "function" ? startApp : null;
window.startApp = function() {
  initSeedDocumentsWithJourney();
  if (_origStartApp) _origStartApp();
  setTimeout(() => {
    renderCurrentStatusCard();
    renderImportantHistoryAlert();
  }, 100);
};

// Run document check on initial script load
if (typeof appData !== "undefined") {
  initSeedDocumentsWithJourney();
}
