import { supabase, dbHelpers, TABLES } from './supabaseClient.js';

// Appointment Booking System
let currentStep = 1;
let selectedDoctor = null;
let selectedDate = null;
let selectedTime = null;
let selectedTimeSlots = [];

// Initialize booking system
document.addEventListener('DOMContentLoaded', function() {
    // Assign globals FIRST
    window.nextStep = nextStep;
    window.previousStep = previousStep;
    window.bookAppointment = bookAppointment;
    window.selectTimeSlot = selectTimeSlot;
    window.logout = logout;

    // Calendar date selection handler
    window.onCalendarDateSelect = async function(dateStr) {
        selectedDate = dateStr;
        console.log('Date selected from calendar:', dateStr);
        await loadAvailableTimeSlots();
        
        // Automatically advance to step 3
        document.getElementById('step2Content').classList.remove('active');
        document.getElementById('step3Content').classList.add('active');
        document.querySelectorAll('.progress-step').forEach(el => el.classList.remove('active'));
        document.getElementById('step3').classList.add('active');
        currentStep = 3;
    };

    window.showCalendarError = function(message) {
        showError(message);
    };

    loadAvailableDoctors();
    loadAppointmentTypes();
    setupDateValidation();
});

// Load available doctors for selection
async function loadAvailableDoctors() {
    try {
        console.log('Loading available doctors...');

        const [doctorsResult, specialitiesResult] = await Promise.all([
            dbHelpers.getAvailableDoctors(),
            dbHelpers.getDoctorSpecialities()
        ]);

        console.log('Doctors response:', doctorsResult);
        console.log('Specialities response:', specialitiesResult);

        if (doctorsResult.error) throw doctorsResult.error;

        const doctorSelect = document.getElementById('doctorSelect');
        doctorSelect.innerHTML = '<option value="">-- Select Doctor --</option>';

        if (!doctorsResult.data || doctorsResult.data.length === 0) {
            doctorSelect.innerHTML = '<option value="">-- No Doctors Available --</option>';
            return;
        }

        // Build speciality lookup map
        const specialityMap = {};
        if (specialitiesResult.data) {
            specialitiesResult.data.forEach(s => {
                specialityMap[s.doctorSpecialityID] = s.Speciality;
            });
        }

        doctorsResult.data.forEach(doctor => {
            const option = document.createElement('option');
            option.value = doctor.doctorID;
            const speciality = specialityMap[doctor.doctorSpecialityID] || 'General Practice';
            option.textContent = `Dr. ${doctor.firstName} ${doctor.lastName} - ${speciality}`;
            doctorSelect.appendChild(option);
        });

        console.log(`Loaded ${doctorsResult.data.length} doctors successfully`);

        doctorSelect.addEventListener('change', function() {
            selectedDoctor = this.value;
            console.log('Doctor selected:', selectedDoctor);
            
            // Initialize calendar if doctor is selected and calendar component is loaded
            if (selectedDoctor && window.calendar) {
                console.log('Initializing calendar for doctor:', selectedDoctor);
                window.calendar.init(selectedDoctor);
            }
            
            // Enable date selection
            if (selectedDoctor) {
                document.getElementById('step2Content').classList.add('active');
                document.getElementById('step1Content').classList.remove('active');
            }
        });

    } catch (error) {
        console.error('Error loading doctors:', error);
        showError('Failed to load available doctors: ' + error.message);
    }
}

// Load appointment types
async function loadAppointmentTypes() {
    try {
        const { data: types, error } = await dbHelpers.getAppointmentTypes();
        if (error) throw error;

        const typeSelect = document.getElementById('appointmentType');
        typeSelect.innerHTML = '<option value="">-- Select Type --</option>';

        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.appointmentTypeID;
            option.textContent = type.type;
            typeSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading appointment types:', error);
        showError('Failed to load appointment types');
    }
}

// Setup date validation (minimum today)
function setupDateValidation() {
    const dateInput = document.getElementById('appointmentDate');
    if (!dateInput) return;

    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    dateInput.addEventListener('change', function() {
        selectedDate = this.value;
        if (selectedDoctor) {
            loadAvailableTimeSlots();
        }
    });
}

// Load available time slots for selected doctor and date
async function loadAvailableTimeSlots() {
    if (!selectedDoctor || !selectedDate) return;

    try {
        console.log('Loading time slots for doctor:', selectedDoctor, 'date:', selectedDate);

        const { data: existingAppointments, error: apptError } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('*')
            .eq('doctorID', selectedDoctor)
            .eq('appointmentDate', selectedDate)
            .in('appointmentStatusID', [1, 2, 4]);

        if (apptError) throw apptError;

        console.log('Existing appointments:', existingAppointments);

        const { data: availability, error: availError } = await supabase
            .from(TABLES.DOCTOR_AVAILABILITY)
            .select('*')
            .eq('doctorID', selectedDoctor)
            .eq('dateAvailable', selectedDate);

        if (availError) throw availError;

        console.log('Doctor availability:', availability);

        let timeSlots = [];

        if (availability && availability.length > 0) {
            // Doctor has availability record - generate 9am-5pm slots, as we can't use the current database layout,
            // because that wouldnt be normalised as there would be multiple time slots for each doctor in a single row. 
            // Changing database currently would introdue a scope creep. 
            // So we generate it instead. Future developements would be for this to be completely based on the database 
            // if the database had a redesigned structure to ensure atomicity of the data.
            for (let hour = 9; hour <= 16; hour++) {
                const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                const endTime = calculateEndTime(timeSlot, 1);

                const isBooked = existingAppointments.some(apt => {
                    const aptStart = apt.startTime.substring(0, 5);
                    return timeSlot === aptStart;
                });

                if (!isBooked) {
                    timeSlots.push({ time: timeSlot, available: true });
                }
            }
        } else {
            // No availability record - doctor not working this day
            console.log('Doctor not available on this date');
        }

        selectedTimeSlots = timeSlots;
        displayTimeSlots(timeSlots);

        console.log('Available slots:', timeSlots.length);

    } catch (error) {
        console.error('Error loading time slots:', error);
        showError('Failed to load available time slots');
    }
}

// Display time slots in the UI
function displayTimeSlots(slots) {
    const container = document.getElementById('timeSlots');
    container.innerHTML = '';

    if (slots.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No available slots for this date.</p>';
        document.getElementById('step3Next').disabled = true;
        return;
    }

    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'time-slot available';
        slotElement.textContent = slot.time;
        slotElement.onclick = () => selectTimeSlot(slot, slotElement);
        container.appendChild(slotElement);
    });

    document.getElementById('step3Next').disabled = true; // disabled until one is selected
}

// Select a time slot
function selectTimeSlot(slot, element) {
    selectedTime = slot.time;

    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));

    if (element) {
        element.classList.add('selected');
    }

    document.getElementById('step3Next').disabled = false;
    updateConfirmationSummary();
}

// Navigation between steps
function nextStep(step) {
    if (currentStep === 1 && !selectedDoctor) {
        showError('Please select a doctor');
        return;
    }
    if (currentStep === 2 && !selectedDate) {
        showError('Please select a date');
        return;
    }
    if (currentStep === 3 && !selectedTime) {
        showError('Please select a time slot');
        return;
    }

    // Load time slots when moving to step 3
    if (step === 3) {
        loadAvailableTimeSlots();
    }

    document.getElementById(`step${currentStep}Content`).classList.remove('active');
    document.getElementById(`step${step}Content`).classList.add('active');

    document.querySelectorAll('.progress-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');

    currentStep = step;
}

function previousStep(step) {
    document.getElementById(`step${currentStep}Content`).classList.remove('active');
    document.getElementById(`step${step}Content`).classList.add('active');

    document.querySelectorAll('.progress-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');

    currentStep = step;
}

// Update confirmation summary
function updateConfirmationSummary() {
    const summaryDiv = document.getElementById('summaryContent');
    const doctorSelect = document.getElementById('doctorSelect');
    const typeSelect = document.getElementById('appointmentType');

    const doctorText = doctorSelect.options[doctorSelect.selectedIndex]?.text || 'Not selected';
    const typeText = typeSelect.options[typeSelect.selectedIndex]?.text || 'Not selected';

    summaryDiv.innerHTML = `
        <p><strong>Doctor:</strong> ${doctorText}</p>
        <p><strong>Date:</strong> ${selectedDate}</p>
        <p><strong>Time:</strong> ${selectedTime}</p>
        <p><strong>Type:</strong> ${typeText}</p>
    `;

    document.getElementById('bookButton').disabled = false;
}

// Book the appointment
async function bookAppointment() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.authenticated) {
            showError('Please login to book an appointment');
            window.location.href = 'login.html';
            return;
        }

        // Final availability check
        const { data: conflict, error: checkError } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('appointmentID')
            .eq('doctorID', parseInt(selectedDoctor))
            .eq('appointmentDate', selectedDate)
            .eq('startTime', selectedTime)
            .not('appointmentStatusID', 'eq', 3);

        if (checkError) {
            showError('Error checking availability. Please try again.');
            return;
        }

        if (conflict && conflict.length > 0) {
            showError('This time slot is no longer available. Please select a different time.');
            previousStep(3);
            loadAvailableTimeSlots();
            return;
        }

        const { data: patient, error: patientError } = await supabase
            .from(TABLES.PATIENT)
            .select('patientID')
            .eq('userInfoID', currentUser.userId)
            .single();

        if (patientError || !patient) {
            showError('Patient information not found');
            return;
        }

        const appointmentData = {
            patientID: patient.patientID,
            doctorID: parseInt(selectedDoctor),
            appointmentDate: selectedDate,
            startTime: selectedTime,
            endTime: calculateEndTime(selectedTime, 1),
            appointmentStatusID: 1,
            appointmentTypeID: parseInt(document.getElementById('appointmentType').value),
            dateCreated: new Date().toISOString().split('T')[0]
        };

        const { data: appointment, error: bookingError } = await dbHelpers.createAppointment(appointmentData);

        if (bookingError) {
            console.error('Booking error:', bookingError);
            showError('Failed to book appointment. Please try again.');
            return;
        }

        showSuccess('Appointment booked successfully!');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);

    } catch (error) {
        console.error('Booking error:', error);
        showError('An error occurred while booking. Please try again.');
    }
}

// Calculate end time
function calculateEndTime(startTime, durationHours = 1) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + durationHours;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function showSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}
