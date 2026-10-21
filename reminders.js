/* ═══════════════════════════════════════════════════════════
   MED-TRACE REMINDERS.JS — Medicine Notification Engine
   Browser Web Notifications + Web Audio Chime + In-App Alerts
═══════════════════════════════════════════════════════════ */

var _reminderInterval = null;
var _firedToday = {};
var COLOR_ICONS = { blue:"💊", teal:"🩺", amber:"☀️", green:"💉", purple:"🫀", orange:"🔶", indigo:"🌙" };
var LABEL_ICONS = { Morning:"🌅", Afternoon:"🌤️", Evening:"🌆", Night:"🌙", General:"💊" };

/* ─── Web Audio Chime Alert ─── */
function playReminderChime() {
  try {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    var ctx = new AudioContext();
    var now = ctx.currentTime;

    // First tone (E5: 659.25Hz)
    var osc1 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second harmonic tone (A5: 880Hz)
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.22);
    gain2.gain.setValueAtTime(0.25, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.65);
  } catch(e) {
    // Audio context not allowed or unsupported
  }
}

/* ─── Permission Management ─── */
function requestNotifPermission(callback) {
  if (!("Notification" in window)) {
    showToast("❌ Browser does not support desktop notifications. In-app alerts will still work.", "error");
    if (callback) callback("unsupported");
    return;
  }
  Notification.requestPermission().then(function(perm) {
    updateNotifBanner(perm);
    if (perm === "granted") {
      showToast("✅ Notifications enabled! You'll receive medicine reminders on time.", "success");
      startReminderService();
      try {
        new Notification("💊 MED-TRACE Reminders Active!", {
          body: "You will now receive medicine reminders on time.\nStay healthy, " + (appData.patient ? appData.patient.name : "Patient") + "!",
          icon: "hero.jpg",
          tag: "medtrace-welcome"
        });
      } catch(e) {}
    } else if (perm === "denied") {
      showToast("⚠️ Notifications blocked in browser settings. Please allow them from the URL bar.", "error");
    }
    if (callback) callback(perm);
  });
}

function updateNotifBanner(perm) {
  var btn = document.getElementById("notifPermBtn");
  var banner = document.getElementById("notifBanner");
  if (!banner) return;
  if (!("Notification" in window)) {
    banner.className = "notif-banner denied";
    banner.innerHTML = "❌ &nbsp; Browser desktop notifications not supported. In-app alarms will still trigger.";
    banner.classList.remove("hidden");
    if (btn) btn.style.display = "none";
    return;
  }
  if (perm === "granted") {
    banner.className = "notif-banner granted";
    banner.innerHTML = "✅ &nbsp; <strong>Notifications enabled!</strong> Reminders will pop up on your screen at scheduled times.";
    banner.classList.remove("hidden");
    if (btn) btn.style.display = "none";
  } else if (perm === "denied") {
    banner.className = "notif-banner denied";
    banner.innerHTML = "🔴 &nbsp; <strong>Notifications blocked.</strong> Click the lock/settings icon in your browser address bar to allow notifications.";
    banner.classList.remove("hidden");
    if (btn) btn.style.display = "none";
  } else {
    banner.className = "notif-banner prompt";
    banner.innerHTML = "⚠️ &nbsp; <strong>Enable notifications</strong> to get audio & desktop alerts when it's time to take your medicines.";
    banner.classList.remove("hidden");
    if (btn) btn.style.display = "";
  }
}

/* ─── Polling Reminder Service ─── */
function startReminderService() {
  if (_reminderInterval) clearInterval(_reminderInterval);
  checkReminders();
  _reminderInterval = setInterval(checkReminders, 30000); // Poll every 30 seconds
}

function todayKey() {
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
}

function todayDayName() {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
}

function checkReminders() {
  var reminders = appData.reminders || [];
  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes();
  var dayName = todayDayName();
  var today = todayKey();

  reminders.forEach(function(rem) {
    if (!rem.active) return;
    if (!rem.days || rem.days.indexOf(dayName) === -1) return;
    var parts = (rem.time || "00:00").split(":");
    var remH = parseInt(parts[0], 10);
    var remM = parseInt(parts[1], 10);
    var fireKey = rem.id + "_" + today + "_" + remH + "_" + remM;

    if (hh === remH && mm === remM && !_firedToday[fireKey]) {
      _firedToday[fireKey] = true;
      fireReminder(rem, false);
    }
  });
}

/* ─── Fire Reminder Alert (Sound + Desktop + In-App) ─── */
function fireReminder(rem, isTest) {
  playReminderChime();

  var timeStr = formatTime12(rem.time);
  var testPrefix = isTest ? "🔔 [TEST REMINDER] " : "💊 Time to take: ";

  // 1. Toast Notification
  showToast(testPrefix + rem.medName + " (" + (rem.timeLabel || timeStr) + ")", "success");

  // 2. Browser Desktop Notification
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      var n = new Notification((isTest ? "⚡ [Test] " : "💊 ") + rem.medName + " — " + timeStr, {
        body: "Dose: " + rem.dosage + " · " + (rem.timeLabel || "") + "\n" + (rem.notes || "") + "\n👨‍⚕️ " + rem.doctor,
        icon: "hero.jpg",
        tag: rem.id + "_" + Date.now(),
        requireInteraction: true
      });
      n.onclick = function() {
        window.focus();
        showSection("reminders", document.getElementById("nav-reminders"));
        n.close();
      };
    } catch(e) {}
  }

  // 3. High-visibility In-App Modal Alert
  showInAppReminderAlert(rem, isTest);
}

/* ─── In-App Alert Modal with "Take Now" and "Snooze" ─── */
function showInAppReminderAlert(rem, isTest) {
  var timeStr = formatTime12(rem.time);
  var badgeText = isTest ? "⚡ TEST REMINDER SIMULATION" : "⏰ TIME TO TAKE YOUR MEDICINE";
  var testNote = isTest ? '<div style="margin-bottom:12px;padding:8px 12px;background:#fef3c7;color:#92400e;border-radius:6px;font-size:12px;font-weight:700">⚡ This is a test reminder demonstration for ' + rem.medName + '.</div>' : '';

  openModal((isTest ? "⚡ Medicine Reminder Alert" : "🔔 Medicine Reminder — " + rem.medName),
    testNote +
    '<div style="text-align:center;padding:10px 0 16px">' +
      '<div style="font-size:48px;animation:activePulse 1.5s ease infinite">💊</div>' +
      '<div style="display:inline-block;margin-top:6px;background:var(--blue-50);color:var(--blue-600);border:1px solid var(--blue-200);border-radius:20px;padding:4px 14px;font-size:11px;font-weight:800;letter-spacing:0.5px">' + badgeText + '</div>' +
      '<h2 style="font-size:22px;font-weight:900;color:var(--ink);margin:12px 0 4px">' + rem.medName + '</h2>' +
      '<div style="font-size:14px;font-weight:700;color:var(--ink-mid)">' + rem.dosage + ' · <span style="color:var(--blue-600)">' + timeStr + ' (' + rem.timeLabel + ')</span></div>' +
    '</div>' +
    '<div style="background:var(--page);border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px;margin-bottom:18px;line-height:1.6">' +
      '<div style="font-size:13px;color:var(--ink);margin-bottom:6px"><strong>Instructions:</strong> ' + (rem.notes || "Take as prescribed.") + '</div>' +
      '<div style="font-size:12px;color:var(--ink-muted)"><strong>Prescribing Doctor:</strong> ' + rem.doctor + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<button class="btn-primary" style="background:var(--green-700);flex:1;min-width:160px;padding:12px 18px" onclick="markDoseTaken(\'' + rem.id + '\')">✅ Mark as Taken</button>' +
      '<button class="btn-secondary" style="flex:1;min-width:140px;padding:12px 18px" onclick="snoozeReminder(\'' + rem.id + '\', 10)">⏰ Snooze 10m</button>' +
    '</div>'
  );
}

/* ─── Mark as Taken ─── */
function markDoseTaken(remId) {
  if (!appData.takenLog) appData.takenLog = {};
  var now = new Date();
  var timeTaken = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  var key = todayKey() + "_" + remId;
  appData.takenLog[key] = timeTaken;
  saveData();
  closeModal();

  var rem = (appData.reminders || []).find(function(r){ return r.id === remId; });
  var medName = rem ? rem.medName : "Medicine";
  showToast("🎉 Excellent! Marked " + medName + " as taken at " + timeTaken + ".", "success");
  renderTodaySchedule();
}

/* ─── Snooze Reminder ─── */
function snoozeReminder(remId, minutes) {
  closeModal();
  var rem = (appData.reminders || []).find(function(r){ return r.id === remId; });
  if (!rem) return;
  showToast("⏰ Snoozed " + rem.medName + " for " + minutes + " minutes.", "success");
  setTimeout(function() {
    fireReminder(rem, false);
  }, minutes * 60000);
}

/* ─── Instant Reminder Tests ─── */
function testReminder(remId) {
  var rem = (appData.reminders || []).find(function(r){ return r.id === remId; });
  if (!rem) return;
  if ("Notification" in window && Notification.permission === "default") {
    requestNotifPermission(function() {
      fireReminder(rem, true);
    });
  } else {
    fireReminder(rem, true);
  }
}

function testMorningMedicineReminder() {
  var rem = (appData.reminders || []).find(function(r){
    return r.medName && r.medName.includes("Medicine 1");
  }) || (appData.reminders || [])[0];

  if (!rem) {
    showToast("No reminder found to test.", "error");
    return;
  }

  if ("Notification" in window && Notification.permission === "default") {
    requestNotifPermission(function() {
      fireReminder(rem, true);
    });
  } else {
    fireReminder(rem, true);
  }
}

/* ─── UI Rendering ─── */
function renderReminders() {
  updateNotifBanner("Notification" in window ? Notification.permission : "unsupported");
  if ("Notification" in window && Notification.permission === "granted") startReminderService();
  renderTodaySchedule();
  renderAllReminders();

  var dateEl = document.getElementById("remindersTodayDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
}

function timeToMins(t) {
  var p = (t || "00:00").split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function formatTime12(t) {
  var p = (t || "00:00").split(":");
  var h = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  return (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m + " " + (h >= 12 ? "PM" : "AM");
}

/* ─── Today's Schedule Timeline ─── */
function renderTodaySchedule() {
  var container = document.getElementById("todaySchedule");
  if (!container) return;

  var reminders = appData.reminders || [];
  var dayName = todayDayName();
  var today = todayKey();
  var now = new Date();
  var nowMins = now.getHours() * 60 + now.getMinutes();

  var todayList = reminders.filter(function(r) {
    return r.active && r.days && r.days.indexOf(dayName) !== -1;
  }).sort(function(a, b) {
    return timeToMins(a.time) - timeToMins(b.time);
  });

  if (!todayList.length) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ink-muted);font-size:13px">' + t("noRemindersToday", "No active reminders scheduled for today. You can enable or add reminders below!") + '</div>';
    return;
  }

  container.innerHTML = todayList.map(function(rem) {
    var remMins = timeToMins(rem.time);
    var isNow = Math.abs(remMins - nowMins) <= 20;
    var isPast = remMins < nowMins - 20;
    var state = isPast ? "past" : isNow ? "now" : "future";
    var contentClass = isNow ? "now-slot" : isPast ? "past-slot" : "";

    var takenKey = today + "_" + rem.id;
    var isTaken = appData.takenLog && appData.takenLog[takenKey];

    var statusHtml = "";
    if (isTaken) {
      statusHtml = '<span class="today-slot-status past-done">✓ ' + t("takenAt", "Taken at") + ' ' + appData.takenLog[takenKey] + '</span>';
    } else if (isNow) {
      statusHtml = '<div style="display:flex;gap:6px;align-items:center">' +
        '<span class="today-slot-status now-due">⏰ ' + t("takeNow", "Take Now!") + '</span>' +
        '<button class="btn-primary" style="padding:4px 10px;font-size:11px;background:var(--green-700)" onclick="markDoseTaken(\'' + rem.id + '\')">' + t("takeBtn", "✓ Take") + '</button>' +
      '</div>';
    } else if (isPast) {
      statusHtml = '<div style="display:flex;gap:6px;align-items:center">' +
        '<span class="today-slot-status past-done" style="background:#fef3c7;color:#92400e;border-color:#fde68a">' + t("dueEarlier", "Due earlier") + '</span>' +
        '<button class="btn-secondary" style="padding:4px 8px;font-size:11px" onclick="markDoseTaken(\'' + rem.id + '\')">' + t("markTaken", "✓ Mark Taken") + '</button>' +
      '</div>';
    } else {
      statusHtml = '<div style="display:flex;gap:6px;align-items:center">' +
        '<span class="today-slot-status future-up">⏳ ' + t("upcoming", "Upcoming") + '</span>' +
        '<button class="btn-secondary" style="padding:4px 8px;font-size:11px" title="Test alert now" onclick="testReminder(\'' + rem.id + '\')">' + t("testBtn", "🔔 Test") + '</button>' +
      '</div>';
    }

    var icon = LABEL_ICONS[rem.label] || "💊";
    var dotIcon = isTaken ? "✓" : isPast ? "⏱" : icon;
    var medDisp = typeof translateClinical === "function" ? translateClinical(rem.medName) : rem.medName;
    var timeLabelDisp = typeof translateClinical === "function" ? translateClinical(rem.timeLabel) : rem.timeLabel;
    var docDisp = typeof translateClinical === "function" ? translateClinical(rem.doctor) : rem.doctor;

    return '<div class="today-slot">' +
      '<div class="today-slot-time">' + formatTime12(rem.time) + '</div>' +
      '<div class="today-slot-dot-wrap"><div class="today-slot-dot ' + (isTaken ? "past" : state) + '">' + dotIcon + '</div></div>' +
      '<div class="today-slot-content ' + contentClass + '">' +
        '<div>' +
          '<div class="today-slot-med">' + medDisp + '</div>' +
          '<div class="today-slot-dose">' + rem.dosage + ' · ' + timeLabelDisp + ' (' + docDisp + ')</div>' +
        '</div>' +
        statusHtml +
      '</div>' +
    '</div>';
  }).join("");
}

/* ─── All Reminders Cards ─── */
function renderAllReminders() {
  var container = document.getElementById("allReminders");
  if (!container) return;

  var reminders = appData.reminders || [];
  if (!reminders.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-muted)">' +
      '<div style="font-size:48px;margin-bottom:12px">🔔</div>' +
      '<div style="font-size:16px;font-weight:800;margin-bottom:8px">' + t("noRemindersYet", "No reminders yet") + '</div>' +
      '<button class="btn-primary" onclick="addReminderModal()">' + t("addReminderBtn", "+ Add Reminder") + '</button>' +
    '</div>';
    return;
  }

  container.innerHTML = reminders.map(function(rem) {
    var color = rem.color || "blue";
    var icon = COLOR_ICONS[color] || "💊";
    var inactive = rem.active ? "" : " inactive";
    var daysText = (rem.days && rem.days.length === 7) ? t("everyDay", "Every day") : (rem.days || []).join(", ");
    var medDisp = typeof translateClinical === "function" ? translateClinical(rem.medName) : rem.medName;
    var timeLabelDisp = typeof translateClinical === "function" ? translateClinical(rem.timeLabel) : rem.timeLabel;
    var notesDisp = typeof translateClinical === "function" ? translateClinical(rem.notes || "") : (rem.notes || "");
    var docDisp = typeof translateClinical === "function" ? translateClinical(rem.doctor) : rem.doctor;
    var labelDisp = typeof translateClinical === "function" ? translateClinical(rem.label) : rem.label;

    return '<div class="reminder-card color-' + color + inactive + '" id="remCard-' + rem.id + '">' +
      '<div class="reminder-icon color-' + color + '">' + icon + '</div>' +
      '<div class="reminder-body">' +
        '<div class="reminder-med-name">' + medDisp + '</div>' +
        '<div class="reminder-dosage">' + rem.dosage + '</div>' +
        '<div class="reminder-meta">' +
          '<span class="rem-time-badge">⏰ ' + formatTime12(rem.time) + '</span>' +
          '<span class="rem-label-badge">' + labelDisp + ' — ' + timeLabelDisp + '</span>' +
          '<span class="rem-days-badge">' + daysText + '</span>' +
        '</div>' +
        '<div class="reminder-notes">' + notesDisp + '</div>' +
        '<div class="reminder-doctor">👨‍⚕️ ' + docDisp + '</div>' +
      '</div>' +
      '<div class="toggle-wrap">' +
        '<label class="toggle-switch">' +
          '<input type="checkbox" ' + (rem.active ? "checked" : "") + ' onchange="toggleReminder(\'' + rem.id + '\', this.checked)">' +
          '<div class="toggle-track"></div>' +
        '</label>' +
        '<div class="toggle-label">' + (rem.active ? "ON" : "OFF") + '</div>' +
      '</div>' +
      '<div class="reminder-actions">' +
        '<button class="rem-action-btn" title="Test Reminder Alert Now" onclick="testReminder(\'' + rem.id + '\')">🔔</button>' +
        '<button class="rem-action-btn" title="Edit Reminder" onclick="editReminderModal(\'' + rem.id + '\')">✏️</button>' +
        '<button class="rem-action-btn delete" title="Delete Reminder" onclick="deleteReminder(\'' + rem.id + '\')">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

function toggleReminder(id, active) {
  var rem = (appData.reminders || []).find(function(r){ return r.id === id; });
  if (!rem) return;
  rem.active = active;
  saveData();
  renderNavBadges();
  renderAllReminders();
  renderTodaySchedule();
  showToast((active ? "🔔 Reminder enabled" : "🔕 Reminder disabled") + ": " + rem.medName, "success");
  if (active && "Notification" in window && Notification.permission === "default") {
    requestNotifPermission();
  }
}

function deleteReminder(id) {
  if (!confirm("Delete this reminder?")) return;
  appData.reminders = (appData.reminders || []).filter(function(r){ return r.id !== id; });
  saveData();
  renderNavBadges();
  renderReminders();
  showToast("🗑️ Reminder deleted.", "success");
}

function addReminderModal() {
  _openReminderForm(null, "rem" + Date.now());
}

function editReminderModal(id) {
  var rem = (appData.reminders || []).find(function(r){ return r.id === id; });
  if (!rem) return;
  _openReminderForm(rem, id);
}

function _openReminderForm(rem, id) {
  var isEdit = !!rem;
  var colors = ["amber","teal","blue","green","orange","indigo","purple"];
  var colorOpts = colors.map(function(c) {
    return '<option value="' + c + '"' + (rem && rem.color === c ? " selected" : "") + '>' +
      c.charAt(0).toUpperCase() + c.slice(1) +
    '</option>';
  }).join("");

  var dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  var daysHtml = dayNames.map(function(d) {
    var ck = !rem || (rem.days && rem.days.indexOf(d) !== -1) ? "checked" : "";
    return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;cursor:pointer">' +
      '<input type="checkbox" name="remDay" value="' + d + '" ' + ck + '> ' + d +
    '</label>';
  }).join("");

  openModal((isEdit ? "✏️ Edit" : "➕ Add") + " Medicine Reminder",
    '<div class="form-group"><label>Medicine Name</label><input id="remMed" placeholder="e.g. Medicine 1 (Pantoprazole 40mg)" value="' + (rem ? rem.medName : "") + '"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div class="form-group"><label>Dosage</label><input id="remDose" placeholder="e.g. 1 tablet" value="' + (rem ? rem.dosage : "1 tablet") + '"></div>' +
      '<div class="form-group"><label>Time</label><input id="remTime" type="time" value="' + (rem ? rem.time : "07:30") + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div class="form-group"><label>Period (Morning / Night...)</label><input id="remLabel" value="' + (rem ? rem.label : "Morning") + '"></div>' +
      '<div class="form-group"><label>Meal Timing / Label</label><input id="remTimeLabel" value="' + (rem ? rem.timeLabel : "Before Breakfast") + '"></div>' +
    '</div>' +
    '<div class="form-group"><label>Prescribing Doctor / Source</label><input id="remDoctor" value="' + (rem ? rem.doctor : "Dr. Rajesh Verma (A)") + '"></div>' +
    '<div class="form-group"><label>Instructions / Food notes</label><textarea id="remNotes" rows="2" style="width:100%;resize:vertical;padding:10px;border:1.5px solid var(--line);border-radius:var(--radius-sm)">' + (rem ? rem.notes : "Take with water before breakfast.") + '</textarea></div>' +
    '<div class="form-group"><label>Color Tag</label><select id="remColor" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:var(--radius-sm)">' + colorOpts + '</select></div>' +
    '<div class="form-group"><label>Repeat on Days</label><div style="display:flex;flex-wrap:wrap;gap:12px;padding:12px;background:var(--page);border-radius:var(--radius-sm);border:1px solid var(--line)">' + daysHtml + '</div></div>' +
    '<button class="btn-save" onclick="saveReminder(\'' + id + '\',' + isEdit + ')">' + (isEdit ? "✅ Update Reminder" : "➕ Add Reminder") + '</button>'
  );
}

function saveReminder(id, isEdit) {
  var med = (document.getElementById("remMed") || {}).value || "";
  var dose = (document.getElementById("remDose") || {}).value || "1 tablet";
  var time = (document.getElementById("remTime") || {}).value || "07:30";
  var label = (document.getElementById("remLabel") || {}).value || "Morning";
  var timeLabel = (document.getElementById("remTimeLabel") || {}).value || "Before Breakfast";
  var doctor = (document.getElementById("remDoctor") || {}).value || "Self";
  var notes = (document.getElementById("remNotes") || {}).value || "";
  var color = (document.getElementById("remColor") || {}).value || "amber";

  if (!med.trim()) {
    showToast("❌ Please enter a medicine name.", "error");
    return;
  }
  var dayCheckboxes = document.querySelectorAll("input[name=remDay]:checked");
  var days = [];
  dayCheckboxes.forEach(function(cb){ days.push(cb.value); });
  if (!days.length) {
    showToast("❌ Please select at least one day.", "error");
    return;
  }

  if (!appData.reminders) appData.reminders = [];

  if (isEdit) {
    var ex = appData.reminders.find(function(r){ return r.id === id; });
    if (ex) {
      ex.medName = med;
      ex.dosage = dose;
      ex.time = time;
      ex.label = label;
      ex.timeLabel = timeLabel;
      ex.doctor = doctor;
      ex.notes = notes;
      ex.color = color;
      ex.days = days;
    }
    showToast("✅ Reminder updated: " + med, "success");
  } else {
    appData.reminders.push({
      id: id,
      medName: med,
      dosage: dose,
      time: time,
      label: label,
      timeLabel: timeLabel,
      doctor: doctor,
      notes: notes,
      color: color,
      days: days,
      active: true,
      lastFired: null
    });
    showToast("🔔 Reminder set: " + med + " at " + formatTime12(time), "success");
  }

  saveData();
  closeModal();
  renderNavBadges();
  renderReminders();

  if ("Notification" in window && Notification.permission === "default") {
    requestNotifPermission();
  }
}

/* ─── Auto-start on load ─── */
(function autoStart() {
  if ("Notification" in window && Notification.permission === "granted") {
    startReminderService();
  }
})();
