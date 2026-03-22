import { supabase, dbHelpers, TABLES } from './supabaseClient.js';

// Appointment Booking System
let currentStep = 1;
let selectedDoctor = null;
let selectedDate = null;
let selectedTime = null;
let selectedTimeSlots = [];

// Initialize booking system
document.addEventListener('DOMContentLoaded', function() {
    loadAvailableDoctors();
    loadAppointmentTypes(); // Add this
    setupDateValidation();
    
    // Make functions globally accessible to HTML onclick handlers
    window.nextStep = nextStep;
    window.previousStep = previousStep;
    window.bookAppointment = bookAppointment;
    window.openRescheduleModal = openRescheduleModal;
    window.closeRescheduleModal = closeRescheduleModal;
    window.confirmReschedule = confirmReschedule;
    window.cancelAppointment = cancelAppointment;
});

// Load available doctors for selection
async function loadAvailableDoctors() {
    try {
        console.log('Loading available doctors...');
        
        // Load doctors and specialities in parallel
        const [doctorsResult, specialitiesResult] = await Promise.all([
            dbHelpers.getAvailableDoctors(),
            dbHelpers.getDoctorSpecialities()
        ]);
        
        console.log('Doctors response:', doctorsResult);
        console.log('Specialities response:', specialitiesResult);
        
        if (doctorsResult.error) {
            console.error('Database error loading doctors:', doctorsResult.error);
            throw doctorsResult.error;
        }
        
        if (specialitiesResult.error) {
            console.error('Database error loading specialities:', specialitiesResult.error);
            // Continue without specialities if there's an error
        }
        
        const doctorSelect = document.getElementById('doctorSelect');
        doctorSelect.innerHTML = '<option value="">-- Select Doctor --</option>';
        
        if (!doctorsResult.data || doctorsResult.data.length === 0) {
            console.warn('No doctors found in database');
            doctorSelect.innerHTML = '<option value="">-- No Doctors Available --</option>';
            return;
        }
        
        // Create speciality lookup map
        const specialityMap = {};
        if (specialitiesResult.data) {
            specialitiesResult.data.forEach(speciality => {
                specialityMap[speciality.doctorSpecialityID] = speciality.Speciality;
            });
        }
        
        // Display doctors with specialities
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
            // Remove loadAppointmentTypes() from here
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
        
        // Check existing appointments for the selected date
        const { data: existingAppointments, error: apptError } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('*')
            .eq('doctorID', selectedDoctor)
            .eq('appointmentDate', selectedDate)
            .in('appointmentStatusID', [1, 2, 4]); // scheduled, confirmed, completed (exclude cancelled)
        
        if (apptError) throw apptError;
        
        console.log('=== DEBUG: All existing appointments for doctor', selectedDoctor, 'on', selectedDate, '===');
        console.log('Existing appointments:', existingAppointments);
        
        // Get doctor's availability from doctorAvailability table
        const { data: availability, error: availError } = await supabase
            .from(TABLES.DOCTOR_AVAILABILITY)
            .select('*')
            .eq('doctorID', selectedDoctor)
            .eq('dateAvailable', selectedDate);
        
        if (availError) throw availError;
        
        console.log('Doctor availability from table:', availability);
        
        let timeSlots = [];
        
        if (availability && availability.length > 0) {
            // Use actual availability from database
            console.log('Using doctor availability from table');
            
            availability.forEach(slot => {
                const timeSlot = slot.timeAvailable.substring(0, 5); // Convert "09:00:00" to "09:00"
                const endTime = calculateEndTime(timeSlot, 1);
                
                // Check if slot is already booked by ANY patient
                const isBooked = existingAppointments.some(apt => {
                    const aptStart = apt.startTime.substring(0, 5); // "16:00:00" -> "16:00"
                    const aptEnd = apt.endTime.substring(0, 5);
                    
                    console.log(`Checking slot ${timeSlot}-${endTime} against appointment ${aptStart}-${aptEnd} (patient ${apt.patientID})`);
                    
                    // Check for any overlap
                    const overlaps = (timeSlot >= aptStart && timeSlot < aptEnd) ||
                                   (endTime > aptStart && endTime <= aptEnd) ||
                                   (timeSlot <= aptStart && endTime >= aptEnd);
                    
                    if (overlaps) {
                        console.log(`CONFLICT: Slot ${timeSlot} conflicts with patient ${apt.patientID}'s appointment at ${aptStart}`);
                    }
                    
                    return overlaps;
                });
                
                if (!isBooked) {
                    timeSlots.push({
                        time: timeSlot,
                        available: true
                    });
                    console.log(`Slot ${timeSlot} is available`);
                }
            });
        } else {
            // Fallback to standard 9-5 hours if no availability in table
            console.log('No availability in table, using standard 9-5 hours');
            
            for (let hour = 9; hour <= 17; hour++) {
                const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
                
                // Check if slot is already booked by ANY patient
                const isBooked = existingAppointments.some(apt => {
                    const aptStart = apt.startTime.substring(0, 5);
                    const aptEnd = apt.endTime.substring(0, 5);
                    
                    console.log(`Checking slot ${timeSlot}-${endTime} against appointment ${aptStart}-${aptEnd} (patient ${apt.patientID})`);
                    
                    const overlaps = (timeSlot >= aptStart && timeSlot < aptEnd) ||
                                   (endTime > aptStart && endTime <= aptEnd) ||
                                   (timeSlot <= aptStart && endTime >= aptEnd);
                    
                    if (overlaps) {
                        console.log(`CONFLICT: Slot ${timeSlot} conflicts with patient ${apt.patientID}'s appointment at ${aptStart}`);
                    }
                    
                    return overlaps;
                });
                
                if (!isBooked) {
                    timeSlots.push({
                        time: timeSlot,
                        available: true
                    });
                    console.log(`✅ Slot ${timeSlot} is available`);
                }
            }
        }
        
        // Sort time slots chronologically
        timeSlots.sort((a, b) => a.time.localeCompare(b.time));
        
        selectedTimeSlots = timeSlots;
        displayTimeSlots(timeSlots);
        
        console.log('=== FINAL AVAILABLE TIME SLOTS ===');
        console.log('Available slots:', timeSlots);
        console.log('Total slots available:', timeSlots.length);
        
    } catch (error) {
        console.error('Error loading time slots:', error);
        showError('Failed to load available time slots');
    }
}

// Display time slots in the UI
function displayTimeSlots(slots) {
    const container = document.getElementById('timeSlots');
    container.innerHTML = '';
    
    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = `time-slot ${slot.available ? 'available' : 'booked'}`;
        slotElement.textContent = slot.time;
        slotElement.onclick = () => selectTimeSlot(slot);
        
        container.appendChild(slotElement);
    });
    
    // Enable next step if slots are available
    const hasAvailableSlots = slots.some(slot => slot.available);
    document.getElementById('step3Next').disabled = !hasAvailableSlots;
}

// Select a time slot
function selectTimeSlot(slot) {
    selectedTime = slot.time;
    
    // Update UI to show selection
    document.querySelectorAll('.time-slot').forEach(el => {
        el.classList.remove('selected');
    });
    
    event.target.classList.add('selected');
    updateConfirmationSummary();
}

// Navigation between steps
function nextStep(step) {
    // Validate current step before proceeding
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
    
    // Hide current step, show next step
    document.getElementById(`step${currentStep}Content`).classList.remove('active');
    document.getElementById(`step${step}Content`).classList.add('active');
    
    // Update progress indicator
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
    
    // Enable booking button
    document.getElementById('bookButton').disabled = false;
}

// Book the appointment
async function bookAppointment() {
    try {
        // Get current user
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.authenticated) {
            showError('Please login to book an appointment');
            window.location.href = 'login.html';
            return;
        }
        
        // Double-check availability before booking
        console.log('Double-checking availability for:', selectedDoctor, selectedDate, selectedTime);
        const { data: existingAppointments, error: checkError } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('appointmentID')
            .eq('doctorID', parseInt(selectedDoctor))
            .eq('appointmentDate', selectedDate)
            .eq('startTime', selectedTime)
            .in('appointmentStatusID', [1, 2, 4]); // exclude cancelled
        
        if (checkError) {
            console.error('Error checking availability:', checkError);
            showError('Error checking availability. Please try again.');
            return;
        }
        
        if (existingAppointments && existingAppointments.length > 0) {
            console.error('Time slot already booked:', existingAppointments);
            showError('This time slot is no longer available. Please select a different time.');
            return;
        }
        
        console.log('Time slot is available, proceeding with booking...');
        
        // Get patient info
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
            endTime: calculateEndTime(selectedTime, 1), // 1 hour default
            appointmentStatusID: 1, // 'scheduled'
            appointmentTypeID: parseInt(document.getElementById('appointmentType').value),
            dateCreated: new Date().toISOString().split('T')[0]
        };
        
        console.log('Creating appointment with data:', appointmentData);
        
        // Insert appointment
        const { data: appointment, error: bookingError } = await dbHelpers.createAppointment(appointmentData);
        
        if (bookingError) {
            console.error('Booking error:', bookingError);
            showError('Failed to book appointment. Please try again.');
            return;
        }
        
        console.log('Appointment created successfully:', appointment);
        showSuccess('Appointment booked successfully!');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Booking error:', error);
        showError('An error occurred while booking. Please try again.');
    }
}

// Calculate end time based on start time and duration
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
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Logout function
function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}
