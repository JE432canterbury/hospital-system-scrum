// Medical Records Management System
import { dbHelpers, supabase, TABLES } from './supabaseClient.js';

let currentUser = null;
let patientData = null;

// Initialize medical records page
document.addEventListener('DOMContentLoaded', function() {
    window.logout = logout;
    window.loadMedicalRecords = loadMedicalRecords;
    initializePage();
});

// Initialize page with authentication check
async function initializePage() {
    try {
        currentUser = JSON.parse(localStorage.getItem('currentUser'));

        if (!currentUser || !currentUser.authenticated) {
            showError('Please login to view medical records');
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            return;
        }

        if (currentUser.role !== 'Patient' && currentUser.role !== 'patient') {
            showError('Access denied. Medical records are only available to patients.');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
            return;
        }

        const { data: fetchedPatient, error: patientError } = await supabase
            .from(TABLES.PATIENT)
            .select('*')
            .eq('userInfoID', currentUser.userId)
            .single();

        if (patientError || !fetchedPatient) {
            showError('Unable to retrieve patient information');
            return;
        }

        patientData = fetchedPatient;
        await loadMedicalRecords();

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize medical records page');
    }
}

// Load medical records and prescriptions
async function loadMedicalRecords() {
    try {
        showLoading();

        if (!patientData) {
            throw new Error('Patient data not available');
        }

        // Fetch records and prescriptions without doctor join to avoid RLS recursion
        const [medicalRecordsResult, prescriptionsResult] = await Promise.all([
            dbHelpers.getPatientMedicalRecords(patientData.patientID),
            dbHelpers.getPatientPrescriptions(patientData.patientID)
        ]);

        if (medicalRecordsResult.error) throw new Error('Failed to load medical records');
        if (prescriptionsResult.error) throw new Error('Failed to load prescriptions');

        const medicalRecords = medicalRecordsResult.data || [];
        const prescriptions = prescriptionsResult.data || [];

        // Collect unique doctor IDs from both sets
        const doctorIds = [...new Set([
            ...medicalRecords.map(r => r.doctorID),
            ...prescriptions.map(p => p.doctorID)
        ])].filter(Boolean);

        // Fetch doctor names in one separate query
        // Uses doctor_select_all_authenticated policy
        const doctorMap = {};
        if (doctorIds.length > 0) {
            const { data: doctors } = await supabase
                .from(TABLES.DOCTOR)
                .select('doctorID, firstName, lastName')
                .in('doctorID', doctorIds);

            if (doctors) {
                doctors.forEach(d => {
                    doctorMap[d.doctorID] = `Dr. ${d.firstName} ${d.lastName}`;
                });
            }
        }

        displayMedicalRecords(medicalRecords, doctorMap);
        displayPrescriptions(prescriptions, doctorMap);

        hideLoading();
        showContent();

    } catch (error) {
        console.error('Error loading medical records:', error);
        hideLoading();
        showError(error.message || 'Failed to load medical records');
    }
}

// Display medical records
function displayMedicalRecords(records, doctorMap = {}) {
    const container = document.getElementById('medicalRecordsList');

    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="no-records">
                <h4>No Medical Records</h4>
                <p>You don't have any medical records in the system yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = records.map(record => `
        <div class="record-card">
            <div class="record-header">
                <div class="record-date">${formatDate(record.recordDate)}</div>
                <div class="record-type">Medical Record</div>
            </div>
            <div class="record-content">
                ${record.recordNotes ? `
                    <div class="record-section">
                        <h5>Notes</h5>
                        <p>${escapeHtml(record.recordNotes)}</p>
                    </div>
                ` : ''}
                ${record.doctorID ? `
                    <div class="record-section">
                        <h5>Attending Doctor</h5>
                        <p>${doctorMap[record.doctorID] || 'Unknown Doctor'}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Display prescriptions
function displayPrescriptions(prescriptions, doctorMap = {}) {
    const container = document.getElementById('prescriptionsList');

    if (!prescriptions || prescriptions.length === 0) {
        container.innerHTML = `
            <div class="no-records">
                <h4>No Prescriptions</h4>
                <p>You don't have any prescriptions in the system yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = prescriptions.map(prescription => `
        <div class="record-card prescription-card">
            <div class="record-header">
                <div class="record-date">${formatDate(prescription.issueDate)}</div>
                <div class="record-type prescription-type">Prescription</div>
            </div>
            <div class="record-content">
                ${prescription.prescriptionNotes ? `
                    <div class="record-section">
                        <h5>Instructions</h5>
                        <p>${escapeHtml(prescription.prescriptionNotes)}</p>
                    </div>
                ` : ''}
                ${prescription.doctorID ? `
                    <div class="record-section">
                        <h5>Prescribing Doctor</h5>
                        <p>${doctorMap[prescription.doctorID] || 'Unknown Doctor'}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// UI State Management
function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('medicalRecordsContent').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
}

function showContent() {
    document.getElementById('medicalRecordsContent').style.display = 'block';
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    const errorState = document.getElementById('errorState');
    if (errorEl) errorEl.textContent = message;
    if (errorState) errorState.style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('medicalRecordsContent').style.display = 'none';
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}
