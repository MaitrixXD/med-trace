const data = {

    patient: {
        id: "PAT-001",
        password: "patient123",
        name: "Aarav Sharma",
        age: 32,
        blood: "B+",
        phone: "+91 98XXXXXX21"
    },

    history: {
        illness: "Hypertension — reported 2019",
        surgery: "Appendix removal — 2015",
        accident: "No accident documented",
        allergies: "No known allergy documented",
        ongoing: "Medicine B — Night"
    },

    doctors: {

        A: {
            name: "Doctor A",
            net: "Mixed",

            meds: [

                {
                    name: "Medicine A",
                    days: "30 days",
                    schedule: "☀ Morning · 8:00 AM",
                    outcome: "Worsened / no improvement"
                },

                {
                    name: "Medicine C",
                    days: "15 days",
                    schedule: "☀ Morning & Night",
                    outcome: "Improved"
                }

            ]
        },

        B: {
            name: "Doctor B",
            net: "Improved",

            meds: [

                {
                    name: "Medicine B",
                    days: "30 days",
                    schedule: " Night · 9:00 PM",
                    outcome: "Improved"
                },

                {
                    name: "Medicine D",
                    days: "10 days",
                    schedule: "☀ Morning · 8:00 AM",
                    outcome: "No change recorded"
                }

            ]
        }

    }

};


function login() {

    const id =
        document.getElementById("patientId").value.trim();

    const pw =
        document.getElementById("password").value;

    if (
        id === data.patient.id &&
        pw === data.patient.password
    ) {

        document
            .getElementById("loginPage")
            .classList.add("hidden");

        document
            .getElementById("app")
            .classList.remove("hidden");

        renderAll();

    } else {

        alert("Invalid patient ID or password.");

    }

}


function logout() {

    location.reload();

}


function showSection(id, btn) {

    document
        .querySelectorAll(".section")
        .forEach(x =>
            x.classList.add("hidden")
        );

    document
        .getElementById(id)
        .classList.remove("hidden");

    document
        .querySelectorAll(".nav")
        .forEach(x =>
            x.classList.remove("active")
        );

    btn.classList.add("active");

}


function renderAll() {

    document
        .getElementById("patientName")
        .textContent = data.patient.name;

    document
        .getElementById("profileName")
        .textContent = data.patient.name;

    document
        .getElementById("profileMeta")
        .textContent =
        `${data.patient.age} years · Blood group ${data.patient.blood} · ${data.patient.phone}`;

    document
        .getElementById("summary")
        .innerHTML = `

        <p>
            <b>Previous:</b>
            ${data.history.illness};
            ${data.history.surgery}.
        </p>

        <p>
            <b>Treatment:</b>
            Doctor A → Medicine A
            (no improvement), then Medicine C
            (improved).
            Doctor B → Medicine B
            (improved).
        </p>

        <p>
            <b>Current:</b>
            ${data.history.ongoing}
        </p>
    `;

    renderDoctor("A");

    renderHistory();

    renderTimeline();

}


function renderDoctor(k) {

    const d = data.doctors[k];

    document
        .getElementById("doctorDetail")
        .innerHTML = `

        <div class="doctor-card">

            <h2>${d.name}</h2>

            <p>
                Documented net outcome:
                <span class="pill">
                    ${d.net}
                </span>
            </p>

            ${d.meds.map(m => `

                <div class="medicine">

                    <b>${m.name}</b>

                    <span>${m.days}</span>

                    <span>${m.schedule}</span>

                    <span class="pill">
                        ${m.outcome}
                    </span>

                </div>

            `).join("")}

            <p class="note">
                Outcome shown here is what was documented
                in follow-up records; the system does not
                claim the medicine caused the outcome.
            </p>

        </div>
    `;

}


function renderHistory() {

    document
        .getElementById("historyView")
        .innerHTML = `

        <div class="history-grid">

            ${Object.entries(data.history)
            .map(([k, v]) => `

                    <div class="history-card">

                        <h3>
                            ${k[0].toUpperCase() + k.slice(1)}
                        </h3>

                        <p>${v}</p>

                    </div>

                `)
            .join("")
        }

        </div>
    `;

}


function renderTimeline() {

    document
        .getElementById("timelineView")
        .innerHTML = `

        <div class="timeline-item">

            <b>12 May</b>

            <p>
                Doctor A visit · Medicine A
                prescribed for 30 days.
            </p>

            <span class="pill">
                No improvement documented
            </span>

        </div>


        <div class="timeline-item">

            <b>Follow-up</b>

            <p>
                Treatment changed to Medicine C.
            </p>

            <span class="pill">
                Improvement documented
            </span>

        </div>


        <div class="timeline-item">

            <b>Next treatment</b>

            <p>
                Doctor B prescribed Medicine B
                for 30 days.
            </p>

            <span class="pill">
                Improvement documented
            </span>

        </div>
    `;

}


function openModal(title, body) {

    document
        .getElementById("modalTitle")
        .textContent = title;

    document
        .getElementById("modalBody")
        .innerHTML = body;

    document
        .getElementById("modal")
        .classList.remove("hidden");

}


function closeModal() {

    document
        .getElementById("modal")
        .classList.add("hidden");

}


function editHistory() {

    openModal(
        "Edit patient history",

        `

        <label>Past illness</label>

        <textarea id="hIll">
            ${data.history.illness}
        </textarea>


        <label>Past surgery</label>

        <textarea id="hSur">
            ${data.history.surgery}
        </textarea>


        <label>Accident</label>

        <textarea id="hAcc">
            ${data.history.accident}
        </textarea>


        <label>Allergies</label>

        <textarea id="hAll">
            ${data.history.allergies}
        </textarea>


        <label>Ongoing medicine</label>

        <textarea id="hOn">
            ${data.history.ongoing}
        </textarea>


        <button class="save"
            onclick="saveHistory()">

            Save changes

        </button>

        `
    );

}


function saveHistory() {

    data.history.illness = hIll.value;

    data.history.surgery = hSur.value;

    data.history.accident = hAcc.value;

    data.history.allergies = hAll.value;

    data.history.ongoing = hOn.value;

    renderHistory();

    renderAll();

    closeModal();

    alert("History updated in this demo.");

}


function editProfile() {

    openModal(
        "Edit profile",

        `

        <label>Name</label>

        <input
            id="pName"
            value="${data.patient.name}"
        >


        <label>Age</label>

        <input
            id="pAge"
            value="${data.patient.age}"
            type="number"
        >


        <label>Phone</label>

        <input
            id="pPhone"
            value="${data.patient.phone}"
        >


        <button
            class="save"
            onclick="saveProfile()">

            Save changes

        </button>

        `
    );

}


function saveProfile() {

    data.patient.name = pName.value;

    data.patient.age = pAge.value;

    data.patient.phone = pPhone.value;

    renderAll();

    closeModal();

    alert("Profile updated in this demo.");

}

function togglePasswordVisibility(inputId, btn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    if (btn) {
        btn.innerHTML = isHidden
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        btn.setAttribute("title", isHidden ? "Hide password" : "Show password");
        btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    }
}