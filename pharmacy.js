var currentMedFilter = "all";
var _orderQty = 1;
var _orderMedId = null;
var _orderPharma = "f1";
var _orderPay = "upi";
var trackingTimers = {};
var TRACKING_STEPS = [
  { label: "Order Placed",     status: "placed",           i18nKey: "orderPlaced"     },
  { label: "Confirmed",        status: "confirmed",        i18nKey: "confirmed"       },
  { label: "Preparing",        status: "preparing",        i18nKey: "preparing"       },
  { label: "Out for Delivery", status: "out_for_delivery", i18nKey: "outForDelivery" },
  { label: "Delivered",        status: "delivered",        i18nKey: "delivered"      }
];
var STEP_ICONS = ["[P]","[C]","[H]","[D]","[O]"];

function renderPharmacy() {
  if (!appData.pharmacy) return;
  var meds = appData.pharmacy.medicines;
  var pharms = appData.pharmacy.pharmacies;
  var lowM = meds.filter(function(m){ return m.stock === "low"; });
  var outM = meds.filter(function(m){ return m.stock === "out"; });
  var banner = document.getElementById("stockAlertBanner");
  if (banner) {
    var parts = [];
    if (outM.length) parts.push("🔴 <strong>" + outM.length + "</strong> " + t("outOfStockAlert", "out of stock") + ": <strong>" + outM.map(function(m){ return m.name; }).join(", ") + "</strong>");
    if (lowM.length) parts.push("🟡 <strong>" + lowM.length + "</strong> " + t("runningLowAlert", "running low") + ": <strong>" + lowM.map(function(m){ return m.name; }).join(", ") + "</strong>");
    banner.innerHTML = parts.length ? "⚠️  " + parts.join("  |  ") : "";
  }
  renderMedicineGrid(meds);
  var pl = document.getElementById("pharmacyList");
  if (pl) {
    pl.innerHTML = pharms.map(function(p) {
      var openTxt = p.open ? "● " + t("openLabel", "Open") : "● " + t("closedLabel", "Closed");
      return '<div class="pharmacy-card"><div class="pharmacy-icon">' + p.icon + '</div><div class="pharmacy-name">' + p.name + '</div><div style="font-size:12px;color:var(--ink-muted);margin-top:2px">' + p.distance + ' ' + t("awayLabel", "away") + '</div><div class="pharmacy-meta"><span class="pharmacy-rating">★ ' + p.rating + '</span><span class="pharmacy-meta-item">⏱ ' + p.time + '</span><span class="pharmacy-meta-item" style="color:' + (p.open ? "var(--green-700)" : "var(--red-600)") + '">' + openTxt + '</span></div></div>';
    }).join("");
  }
}

function renderMedicineGrid(meds) {
  var grid = document.getElementById("medicineStoreGrid");
  if (!grid) return;
  var filtered = currentMedFilter === "all" ? meds : meds.filter(function(m){ return m.stock === currentMedFilter; });
  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-muted);font-weight:600">' + t("noMedsFilter", "No medicines found for this filter.") + '</div>';
    return;
  }
  grid.innerHTML = filtered.map(function(m) {
    var stockLabel = m.stock === "available" ? t("inStock", "🟢 In Stock") : m.stock === "low" ? t("lowStock", "🟡 Low Stock") : t("outOfStock", "🔴 Out of Stock");
    var stockClass = m.stock === "available" ? "available" : m.stock === "low" ? "low" : "out";
    var cardClass  = m.stock === "out" ? "out-of-stock" : m.stock === "low" ? "low-stock" : "";
    var docLabel   = (m.prescribed && m.doctorKey) ? '<span class="med-card-prescribed">✅ ' + t("prescribedBy", "Prescribed by") + ' Dr. ' + m.doctorKey + '</span>' : "";
    var stripInfo  = m.stock === "out" ? '<span style="color:var(--red-600);font-weight:700">' + t("unavailable", "Unavailable") + '</span>' : m.strips + " " + (m.strips !== 1 ? t("stripsLeft", "strips left") : t("stripLeft", "strip left"));
    var btnLabel = m.stock === "out" ? t("notifyMe", "🔔 Notify") : t("orderNow", "🛒 Order Now");
    var btnExtra = m.stock === "out" ? " out-btn" : "";
    return '<div class="med-store-card ' + cardClass + '" id="medCard-' + m.id + '"><div class="med-card-top"><span class="stock-status-badge ' + stockClass + '">' + stockLabel + '</span><div class="med-card-icon">💊</div><div class="med-card-name">' + m.name + '</div><div class="med-card-brand">' + m.brand + '</div><div style="font-size:11px;color:var(--ink-muted);margin-top:4px">' + m.category + '</div>' + docLabel + '</div><div class="med-card-bottom"><div><div class="med-card-price">₹' + m.price + ' <small>/ strip</small></div><div class="med-strips-info">' + stripInfo + '</div></div><button class="btn-order' + btnExtra + '" onclick="openOrderModal(\'' + m.id + '\')">' + btnLabel + '</button></div></div>';
  }).join("");
}

function filterMeds(filter, btn) {
  currentMedFilter = filter;
  document.querySelectorAll(".pharma-tab").forEach(function(t){ t.classList.remove("active"); });
  if (btn) btn.classList.add("active");
  renderMedicineGrid(appData.pharmacy.medicines);
}

function openOrderModal(medId) {
  var med = appData.pharmacy.medicines.find(function(m){ return m.id === medId; });
  if (!med) return;
  _orderMedId = medId; _orderQty = 1;
  _orderPharma = appData.pharmacy.pharmacies[0].id; _orderPay = "upi";
  if (med.stock === "out") {
    openModal("🔔 Notify When Available",
      '<div class="order-modal-med"><div class="order-modal-med-icon">💊</div><div><div class="order-med-name">' + med.name + '</div><div class="order-med-brand">' + med.brand + '</div><div style="margin-top:6px;font-size:12px;color:var(--red-600);font-weight:700">🔴 Currently out of stock</div></div></div>' +
      '<p style="font-size:13px;color:var(--ink-muted);line-height:1.6;margin-bottom:14px">We will notify you as soon as this medicine is restocked nearby.</p>' +
      '<div class="form-group"><label>Your phone number</label><input id="notifyPhone" value="' + appData.patient.phone + '"></div>' +
      '<button class="btn-save" onclick="submitNotify(\'' + med.id + '\')">🔔 Notify Me When Available</button>'
    );
    return;
  }
  var pharmsHtml = appData.pharmacy.pharmacies.map(function(p, i) {
    return '<label class="modal-pharmacy-option ' + (i === 0 ? "selected" : "") + '" id="pharmaOpt-' + p.id + '" onclick="selectPharma(\'' + p.id + '\')">' +
      '<input type="radio" name="pharmacy" value="' + p.id + '"' + (i === 0 ? " checked" : "") + '>' +
      '<div><div class="modal-pharma-name">' + p.icon + ' ' + p.name + '</div><div class="modal-pharma-sub">⭐ ' + p.rating + ' · ' + p.distance + '</div></div>' +
      '<span class="modal-pharma-time">⏱ ' + p.time + '</span></label>';
  }).join("");

  openModal("🛒 Order — " + med.name,
    '<div class="order-modal-med"><div class="order-modal-med-icon">💊</div><div><div class="order-med-name">' + med.name + '</div><div class="order-med-brand">' + med.brand + ' · ' + med.category + '</div><div class="order-med-price">₹' + med.price + ' / strip</div></div></div>' +
    '<div class="modal-section-title">How many strips (packs)?</div>' +
    '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:4px"><div class="qty-selector">' +
    '<button class="qty-btn" onclick="changeQty(-1,' + med.price + ',' + med.strips + ')">−</button>' +
    '<div class="qty-display" id="qtyDisplay">1</div>' +
    '<button class="qty-btn" onclick="changeQty(1,' + med.price + ',' + med.strips + ')">+</button>' +
    '</div><span style="font-size:13px;color:var(--ink-muted)">Max <strong>' + med.strips + '</strong> strip' + (med.strips !== 1 ? "s" : "") + '</span></div>' +
    '<div class="modal-section-title">Select Pharmacy</div><div class="modal-pharmacy-grid">' + pharmsHtml + '</div>' +
    '<div class="modal-section-title">Payment Method</div>' +
    '<div class="payment-methods">' +
    '<div class="payment-option selected" id="pay-upi" onclick="selectPayment(\'upi\')"><span class="payment-option-icon">📱</span>UPI</div>' +
    '<div class="payment-option" id="pay-card" onclick="selectPayment(\'card\')"><span class="payment-option-icon">💳</span>Card</div>' +
    '<div class="payment-option" id="pay-cod" onclick="selectPayment(\'cod\')"><span class="payment-option-icon">💵</span>Cash on Delivery</div></div>' +
    '<div id="upiField" class="form-group" style="margin-top:4px"><label>UPI ID</label><input id="upiId" placeholder="yourname@upi" value="aarav@oksbi"></div>' +
    '<div id="cardField" class="form-group hidden" style="margin-top:4px"><label>Card Number</label><input id="cardNum" placeholder="XXXX XXXX XXXX XXXX" maxlength="19"></div>' +
    '<div class="modal-section-title">Order Summary</div>' +
    '<div style="background:var(--page);border-radius:var(--radius-sm);border:1px solid var(--line);padding:14px">' +
    '<div class="order-summary-row"><span>' + med.name + ' × <span id="sumQty">1</span> strip</span><span>₹<span id="sumSubtotal">' + med.price + '</span></span></div>' +
    '<div class="order-summary-row"><span>Delivery</span><span style="color:var(--green-700);font-weight:700">FREE 🎉</span></div>' +
    '<div class="order-summary-row total"><span>Total</span><span class="summary-val">₹<span id="sumTotal">' + med.price + '</span></span></div></div>' +
    '<button class="btn-place-order" onclick="placeOrder(\'' + med.id + '\')">✅ Place Order — ₹<span id="btnTotal">' + med.price + '</span></button>' +
    '<p style="text-align:center;font-size:11px;color:var(--ink-muted);margin-top:8px">⏱ Estimated delivery: 30–60 min · 📍 ' + appData.patient.address.split(",")[0] + '</p>'
  );
}

function changeQty(delta, pricePerStrip, maxStrips) {
  _orderQty = Math.max(1, Math.min(maxStrips, _orderQty + delta));
  var total = _orderQty * pricePerStrip;
  function set(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  set("qtyDisplay", _orderQty); set("sumQty", _orderQty);
  set("sumSubtotal", total); set("sumTotal", total); set("btnTotal", total);
}

function selectPharma(id) {
  _orderPharma = id;
  document.querySelectorAll(".modal-pharmacy-option").forEach(function(e){ e.classList.remove("selected"); });
  var opt = document.getElementById("pharmaOpt-" + id);
  if (opt) { opt.classList.add("selected"); var r = opt.querySelector("input[type=radio]"); if (r) r.checked = true; }
}

function selectPayment(method) {
  _orderPay = method;
  document.querySelectorAll(".payment-option").forEach(function(e){ e.classList.remove("selected"); });
  var el = document.getElementById("pay-" + method); if (el) el.classList.add("selected");
  var uF = document.getElementById("upiField");
  var cF = document.getElementById("cardField");
  if (uF) uF.classList.toggle("hidden", method !== "upi");
  if (cF) cF.classList.toggle("hidden", method !== "card");
}

function placeOrder(medId) {
  var med   = appData.pharmacy.medicines.find(function(m){ return m.id === medId; });
  var pharm = appData.pharmacy.pharmacies.find(function(p){ return p.id === _orderPharma; });
  if (!med || !pharm) return;
  if (_orderPay === "upi") {
    var upiVal = (document.getElementById("upiId") || {}).value || "";
    if (!upiVal.includes("@")) { showToast("❌ Please enter a valid UPI ID (e.g. name@upi)", "error"); return; }
  }
  if (_orderPay === "card") {
    var cardVal = (document.getElementById("cardNum") || {}).value || "";
    if (cardVal.replace(/\s/g, "").length < 12) { showToast("❌ Please enter a valid card number", "error"); return; }
  }
  var orderId = "ORD-" + Date.now().toString().slice(-6);
  var now = new Date();
  var etaMins = parseInt(pharm.time.split("-")[1]) || 45;
  var eta = new Date(now.getTime() + etaMins * 60000);
  var order = {
    id: orderId, medId: med.id, medName: med.name, medBrand: med.brand,
    qty: _orderQty, price: med.price * _orderQty,
    pharmacyId: pharm.id, pharmacy: pharm.name, payment: _orderPay,
    status: "placed", stepIndex: 0,
    placedAt: now.toISOString(), etaTime: eta.toISOString(),
    address: appData.patient.address
  };
  if (!appData.pharmacy.orders) appData.pharmacy.orders = [];
  appData.pharmacy.orders.unshift(order);
  med.strips = Math.max(0, (med.strips || 0) - _orderQty);
  if (med.strips === 0) med.stock = "out";
  else if (med.strips <= 2) med.stock = "low";
  else med.stock = "available";
  saveData(); closeModal(); renderNavBadges(); renderPharmacy();
  if (typeof syncOrderToBackend === "function") syncOrderToBackend(order);
  showToast("✅ " + orderId + " placed! Delivering in ~" + etaMins + " min 🛵", "success");
  setTimeout(function() {
    showSection("orders", document.getElementById("nav-orders"));
    startDeliveryTracking(orderId);
  }, 700);
}

function submitNotify(medId) {
  var phone = (document.getElementById("notifyPhone") || {}).value || appData.patient.phone;
  closeModal();
  showToast("🔔 We will notify " + phone + " when available!", "success");
}

function startDeliveryTracking(orderId) {
  if (trackingTimers[orderId]) return;
  var schedule = [
    { delay: 0,      stepIndex: 0, status: "placed"           },
    { delay: 20000,  stepIndex: 1, status: "confirmed"        },
    { delay: 50000,  stepIndex: 2, status: "preparing"        },
    { delay: 100000, stepIndex: 3, status: "out_for_delivery" },
    { delay: 420000, stepIndex: 4, status: "delivered"        }
  ];
  schedule.forEach(function(s) {
    setTimeout(function() {
      var orders = appData.pharmacy.orders || [];
      var order  = orders.find(function(o){ return o.id === orderId; });
      if (!order || order.status === "cancelled") return;
      order.stepIndex = s.stepIndex; order.status = s.status;
      saveData(); renderNavBadges();
      var sec = document.getElementById("orders");
      if (sec && !sec.classList.contains("hidden")) renderOrders();
      if (s.status === "confirmed")        showToast("✅ " + orderId + " confirmed by " + order.pharmacy + "!", "success");
      if (s.status === "preparing")        showToast("🏪 " + order.pharmacy + " is packing your order...", "success");
      if (s.status === "out_for_delivery") showToast("🛵 Your medicine is on the way!", "success");
      if (s.status === "delivered") { showToast("🎉 \"" + order.medName + "\" delivered!", "success"); delete trackingTimers[orderId]; }
    }, s.delay);
  });
  trackingTimers[orderId] = true;
}

function renderOrders() {
  var container = document.getElementById("ordersContent");
  if (!container) return;
  var orders = appData.pharmacy ? (appData.pharmacy.orders || []) : [];
  if (!orders.length) {
    container.innerHTML = '<div class="orders-empty"><div class="orders-empty-icon">🛵</div><div class="orders-empty-title">' + t("noOrders", "No orders yet") + '</div><div class="orders-empty-sub">' + t("noOrdersSub", "Your medicine orders will appear here with live delivery tracking.") + '</div><button class="btn-primary" onclick="showSection(\'pharmacy\',document.getElementById(\'nav-pharmacy\'))">' + t("goToPharmacy", "💊 Go to Pharmacy") + '</button></div>';
    return;
  }
  var pillMap = {
    placed: "📋 " + t("orderPlaced", "Order Placed"),
    confirmed: "✅ " + t("confirmed", "Confirmed"),
    preparing: "🏪 " + t("preparing", "Preparing"),
    out_for_delivery: "🛵 " + t("outForDelivery", "Out for Delivery"),
    delivered: "🎉 " + t("delivered", "Delivered"),
    cancelled: "❌ " + t("cancelled", "Cancelled")
  };
  var payMap  = {upi:"📱 UPI",card:"💳 Card",cod:"💵 Cash on Delivery"};
  container.innerHTML = orders.map(function(order) {
    var stepIdx  = order.stepIndex || 0;
    var isActive = order.status !== "delivered" && order.status !== "cancelled";
    var pillClass = order.status === "delivered" ? "delivered" : order.status === "cancelled" ? "cancelled" : "active";
    var pillLabel = pillMap[order.status] || ("📋 " + t("orderPlaced", "Placed"));
    var etaStr = "";
    if (isActive && order.etaTime) {
      var mins = Math.max(0, Math.round((new Date(order.etaTime) - new Date()) / 60000));
      etaStr = mins > 0 ? "~" + mins + " " + t("minRemaining", "min remaining") : t("arrivingMoment", "Arriving any moment...");
    }
    var trackerHtml = TRACKING_STEPS.map(function(step, i) {
      var done = i < stepIdx, cur = i === stepIdx;
      var dotCls = done ? "done" : cur ? "active" : "";
      var lblCls = done ? "done" : cur ? "active" : "";
      var icon = done ? "✓" : (["📋","✅","🏪","🛵","🎉"][i] || i);
      var conn = i < TRACKING_STEPS.length - 1 ? '<div class="tracker-connector ' + (i < stepIdx ? "done" : "") + '"></div>' : "";
      var stepLabelText = t(step.i18nKey, step.label);
      return '<div class="tracker-step"><div class="tracker-step-dot ' + dotCls + '">' + icon + '</div><div class="tracker-step-label ' + lblCls + '">' + stepLabelText + '</div></div>' + conn;
    }).join("");
    var etaBanner = isActive ?
      '<div class="order-eta-row"><span class="eta-icon">🛵</span><span class="eta-text">' +
      (order.status==="out_for_delivery" ? t("outForDelivery", "Your medicine is on the way!") : order.status==="preparing" ? t("preparing", "Pharmacy is packing your order...") : t("orderPlaced", "Order is being processed...")) +
      '</span><span class="eta-time">' + etaStr + '</span></div>'
      : order.status === "delivered" ?
      '<div class="order-eta-row" style="background:var(--blue-50);border-color:var(--blue-200)"><span class="eta-icon">🎉</span><span class="eta-text" style="color:var(--blue-700)">' + t("deliveredSuccess", "Delivered successfully!") + '</span></div>' : "";
    var placedTime = new Date(order.placedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
    var placedDate = new Date(order.placedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
    var payLabel = payMap[order.payment] || order.payment;
    var qtyLabel = order.qty + " " + (order.qty > 1 ? t("stripsLeft", "strips") : t("stripLeft", "strip"));
    return '<div class="order-track-card">' +
      '<div class="order-track-header"><div><div class="order-track-id">' + order.id + '</div><div class="order-track-med">' + order.medName + ' × ' + qtyLabel + '</div><div class="order-track-meta">' + order.pharmacy + ' · ' + placedDate + ' at ' + placedTime + '</div></div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><span class="order-status-pill ' + pillClass + '">' + pillLabel + '</span><span style="font-size:15px;font-weight:900;color:var(--ink)">₹' + order.price + '</span></div></div>' +
      '<div class="order-track-body"><div class="tracker-steps">' + trackerHtml + '</div>' + etaBanner +
      '<div class="order-detail-grid">' +
      '<div class="order-detail-item"><div class="order-detail-label">' + t("medLabel", "Medicine") + '</div><div class="order-detail-value">' + order.medName + '</div></div>' +
      '<div class="order-detail-item"><div class="order-detail-label">' + t("qtyLabel", "Quantity") + '</div><div class="order-detail-value">' + qtyLabel + '</div></div>' +
      '<div class="order-detail-item"><div class="order-detail-label">' + t("paymentLabel", "Payment") + '</div><div class="order-detail-value">' + payLabel + '</div></div>' +
      '<div class="order-detail-item"><div class="order-detail-label">' + t("pharmacyLabel", "Pharmacy") + '</div><div class="order-detail-value">' + order.pharmacy + '</div></div>' +
      '<div class="order-detail-item" style="grid-column:1/-1"><div class="order-detail-label">' + t("deliveryAddressLabel", "Delivery Address") + '</div><div class="order-detail-value">' + order.address + '</div></div>' +
      '</div></div></div>';
  }).join("");
  orders.forEach(function(order) {
    if (order.status !== "delivered" && order.status !== "cancelled" && !trackingTimers[order.id]) startDeliveryTracking(order.id);
  });
}

