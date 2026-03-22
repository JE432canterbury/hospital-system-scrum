import { supabase, dbHelpers, TABLES } from './supabaseClient.js';

// Appointment Management System
let currentAppointments = [];
let selectedAppointment = null;

// Initialize appointment management
document.addEventListener('DOMContentLoaded', function() {
    loadAppointments();
    
    // Make functions globally accessible to HTML onclick handlers
    window.openRescheduleModal = openRescheduleModal;
    window.closeRescheduleModal = closeRescheduleModal;
    window.confirmReschedule = confirmReschedule;
    window.cancelAppointment = cancelAppointment;
    window.deleteAppointment = deleteAppointment;
    window.onRescheduleDateChange = onRescheduleDateChange;
});

// Load user's appointments
async function loadAppointments() {
    try {
        // Get current user
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser || !currentUser.authenticated) {
            showError('Please login to view appointments');
            window.location.href = 'login.html';
            return;
        }
        
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
        
        // Load appointments
        const { data: appointments, error: apptError } = await dbHelpers.getPatientAppointments(patient.patientID);
        
        if (apptError) throw apptError;
        
        currentAppointments = appointments || [];
        displayAppointments(currentAppointments);
        
    } catch (error) {
        console.error('Error loading appointments:', error);
        showError('Failed to load appointments');
    }
}

// Display appointments in the UI
function displayAppointments(appointments) {
    const container = document.getElementById('appointmentsList');
    const emptyState = document.getElementById('emptyState');
    
    if (!appointments || appointments.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    appointments.forEach(appointment => {
        const appointmentCard = createAppointmentCard(appointment);
        container.appendChild(appointmentCard);
    });
}

// Create appointment card element
function createAppointmentCard(appointment) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    
    const statusClass = getStatusClass(appointment.appointmentStatusID);
    const statusText = getStatusText(appointment.appointmentStatusID);
    
    card.innerHTML = `
        <div class="appointment-header">
            <h3>${appointment.appointmentType?.type || 'Appointment'}</h3>
            <span class="appointment-status ${statusClass}">${statusText}</span>
        </div>
        <div class="appointment-details">
            <div class="appointment-info">
                <div class="info-item">
                    <strong>Doctor:</strong> 
                    ${appointment.doctor?.firstName && appointment.doctor?.lastName ? `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}` : 'Unknown Doctor'}
                </div>
                <div class="info-item">
                    <strong>Date:</strong> ${formatDate(appointment.appointmentDate)}
                </div>
                <div class="info-item">
                    <strong>Time:</strong> ${formatTime(appointment.startTime)} - ${formatTime(appointment.endTime)}
                </div>
            </div>
            <div class="appointment-actions">
                ${appointment.appointmentStatusID === 1 ? `
                    <button class="btn btn-primary btn-sm" onclick="openRescheduleModal(${appointment.appointmentID})">
                        Reschedule
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="cancelAppointment(${appointment.appointmentID})">
                        Cancel
                    </button>
                ` : ''}
                ${appointment.appointmentStatusID === 3 ? `
                    <button class="btn btn-danger btn-sm" onclick="deleteAppointment(${appointment.appointmentID})">
                        Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// Get status class for styling
function getStatusClass(statusId) {
    switch (statusId) {
        case 1: return 'status-scheduled';
        case 2: return 'status-confirmed';
        case 3: return 'status-cancelled';
        case 4: return 'status-completed';
        default: return 'status-unknown';
    }
}

// Get status text
function getStatusText(statusId) {
    switch (statusId) {
        case 1: return 'Scheduled';
        case 2: return 'Confirmed';
        case 3: return 'Cancelled';
        case 4: return 'Completed';
        default: return 'Unknown';
    }
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format time for display
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Open reschedule modal
async function openRescheduleModal(appointmentId) {
    selectedAppointment = currentAppointments.find(apt => apt.appointmentID === appointmentId);
    
    if (!selectedAppointment) {
        showError('Appointment not found');
        return;
    }
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('rescheduleDate').min = today;
    document.getElementById('rescheduleDate').value = selectedAppointment.appointmentDate;
    
    // Load available time slots for the selected date
    await loadRescheduleTimeSlots(selectedAppointment.doctorID, selectedAppointment.appointmentDate);
    
    // Show modal
    document.getElementById('rescheduleModal').style.display = 'block';
}

// Load time slots for rescheduling
async function loadRescheduleTimeSlots(doctorId, date) {
    try {
        console.log('Loading reschedule time slots for doctor:', doctorId, 'date:', date);
        
        // Check existing appointments for the selected date (EXCLUDE current appointment)
        const { data: existingAppointments, error: apptError } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('*')
            .eq('doctorID', doctorId)
            .eq('appointmentDate', date)
            .in('appointmentStatusID', [1, 2, 4]) // scheduled, confirmed, completed (exclude cancelled)
            .neq('appointmentID', selectedAppointment.appointmentID); // EXCLUDE current appointment
        
        if (apptError) throw apptError;
        
        console.log('Existing appointments for reschedule (excluding current):', existingAppointments);
        
        const timeSelect = document.getElementById('rescheduleTime');
        timeSelect.innerHTML = '<option value="">Select Time</option>';
        
        // Generate time slots (9 AM - 5 PM) and check availability
        for (let hour = 9; hour <= 17; hour++) {
            const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
            const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
            
            // Check if slot is already booked by ANY patient
            const isBooked = existingAppointments.some(apt => {
                const aptStart = apt.startTime.substring(0, 5); // "16:00:00" -> "16:00"
                const aptEnd = apt.endTime.substring(0, 5);
                
                console.log(`Checking reschedule slot ${timeSlot}-${endTime} against appointment ${aptStart}-${aptEnd} (patient ${apt.patientID})`);
                
                const overlaps = (timeSlot >= aptStart && timeSlot < aptEnd) ||
                               (endTime > aptStart && endTime <= aptEnd) ||
                               (timeSlot <= aptStart && endTime >= aptEnd);
                
                if (overlaps) {
                    console.log(`RESCHEDULE CONFLICT: Slot ${timeSlot} conflicts with patient ${apt.patientID}'s appointment at ${aptStart}`);
                }
                
                return overlaps;
            });
            
            if (!isBooked) {
                const option = document.createElement('option');
                option.value = timeSlot;
                option.textContent = formatTime(timeSlot);
                timeSelect.appendChild(option);
                console.log(`Reschedule slot ${timeSlot} is available`);
            }
        }
        
        console.log('Available reschedule time slots loaded');
        
    } catch (error) {
        console.error('Error loading time slots:', error);
        showError('Failed to load available time slots');
    }
}

// Handle date change in reschedule modal
async function onRescheduleDateChange() {
    const newDate = document.getElementById('rescheduleDate').value;
    const doctorId = selectedAppointment.doctorID;
    
    if (newDate && doctorId) {
        console.log('Date changed to:', newDate, 'reloading time slots');
        await loadRescheduleTimeSlots(doctorId, newDate);
    }
}

// Helper function to calculate end time
function calculateEndTime(startTime, durationHours = 1) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + durationHours;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Close reschedule modal
function closeRescheduleModal() {
    document.getElementById('rescheduleModal').style.display = 'none';
    selectedAppointment = null;
}

// Confirm reschedule
async function confirmReschedule() {
    if (!selectedAppointment) return;
    
    const newDate = document.getElementById('rescheduleDate').value;
    const newTime = document.getElementById('rescheduleTime').value;
    
    if (!newDate || !newTime) {
        showError('Please select both date and time');
        return;
    }
    
    try {
        // Final availability check before rescheduling
        console.log('Final reschedule availability check for doctor:', selectedAppointment.doctorID, 'date:', newDate, 'time:', newTime);
        
        // Get all appointments for that doctor on that date (excluding current)
        const { data: allAppointments, error: checkError } = await supabase
            .from(TABLES.APPOINTMENT)
            .select('appointmentID, patientID, startTime, endTime')
            .eq('doctorID', selectedAppointment.doctorID)
            .eq('appointmentDate', newDate)
            .in('appointmentStatusID', [1, 2, 4]) // scheduled, confirmed, completed (exclude cancelled)
            .neq('appointmentID', selectedAppointment.appointmentID); // EXCLUDE current appointment
        
        if (checkError) throw checkError;
        
        console.log('All appointments for conflict check:', allAppointments);
        
        // Check for overlapping time slots
        const newStart = newTime;
        const newEnd = calculateEndTime(newTime, 1); // Assuming 1-hour appointments
        
        const hasOverlap = allAppointments.some(apt => {
            const aptStart = apt.startTime.substring(0, 5); // "10:00:00" -> "10:00"
            const aptEnd = apt.endTime.substring(0, 5);
            
            console.log(`Checking overlap: New ${newStart}-${newEnd} vs Existing ${aptStart}-${aptEnd}`);
            
            // Check for any overlap
            const overlaps = (newStart >= aptStart && newStart < aptEnd) ||
                           (newEnd > aptStart && newEnd <= aptEnd) ||
                           (newStart <= aptStart && newEnd >= aptEnd);
            
            if (overlaps) {
                console.log(`OVERLAP DETECTED: New appointment conflicts with patient ${apt.patientID}`);
            }
            
            return overlaps;
        });
        
        if (hasOverlap) {
            console.error('RESCHEDULE CONFLICT: Time slot overlaps with existing appointment');
            showError('This time slot is no longer available. Please select a different time.');
            return;
        }
        
        console.log('Reschedule time slot is available, proceeding...');
        
        const newDateTime = `${newDate}T${newTime}`;
        const result = await dbHelpers.rescheduleAppointment(selectedAppointment.appointmentID, newDateTime);
        
        if (result.error) {
            showError('Failed to reschedule appointment');
            return;
        }
        
        showSuccess('Appointment rescheduled successfully!');
        closeRescheduleModal();
        loadAppointments(); // Refresh the appointments list
        
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        showError('An error occurred while rescheduling. Please try again.');
    }
}

// Cancel appointment
async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }
    
    try {
        const result = await dbHelpers.cancelAppointment(appointmentId);
        
        if (result.error) {
            showError('Failed to cancel appointment');
            return;
        }
        
        showSuccess('Appointment cancelled successfully!');
        loadAppointments(); // Refresh the list
        
    } catch (error) {
        console.error('Cancel error:', error);
        showError('An error occurred while cancelling');
    }
}

// Delete appointment completely
async function deleteAppointment(appointmentId) {
    if (!confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
        return;
    }
    
    try {
        const result = await dbHelpers.deleteAppointment(appointmentId);
        
        if (result.error) {
            showError('Failed to delete appointment');
            return;
        }
        
        showSuccess('Appointment deleted successfully!');
        loadAppointments(); // Refresh the list
        
    } catch (error) {
        console.error('Delete error:', error);
        showError('An error occurred while deleting');
    }
}

// Utility functions
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

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('rescheduleModal');
    if (event.target === modal) {
        closeRescheduleModal();
    }
}
