// Calendar Component for Real Time Doctor Availability
import { supabase } from './supabaseClient.js';

class DoctorCalendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDoctor = null;
        this.selectedDate = null;
        this.calendarData = null;
    }

    // Initialize calendar
    async init(doctorId) {
        this.selectedDoctor = doctorId;
        await this.loadCalendarData();
        this.render();
    }

    // Load calendar data for current month
    async loadCalendarData() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Calculate last day of month 
        const lastDay = new Date(year, month + 1, 0).getDate();
        const firstDayStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDayStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        try {
            // Get doctor availability for month
            const { data: availability, error: availError } = await supabase
                .from('doctoravailability')
                .select('*')
                .eq('doctorID', this.selectedDoctor)
                .gte('dateAvailable', firstDayStr)
                .lte('dateAvailable', lastDayStr);

            if (availError) throw availError;

            // Get existing appointments for month
            const { data: appointments, error: apptError } = await supabase
                .from('appointment')
                .select('*')
                .eq('doctorID', this.selectedDoctor)
                .in('appointmentStatusID', [1, 2, 4])
                .gte('appointmentDate', firstDayStr)
                .lte('appointmentDate', lastDayStr);

            if (apptError) throw apptError;

            this.calendarData = this.processCalendarData(year, month, availability || [], appointments || []);
            console.log('Calendar data loaded:', { availability: availability?.length, appointments: appointments?.length });

        } catch (error) {
            console.error('Error loading calendar data:', error);
            this.showError('Failed to load calendar data');
        }
    }

    // Process calendar data and determine day statuses
    processCalendarData(year, month, availability, appointments) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        const calendarDays = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayStatus = this.getDayStatus(dateStr, availability, appointments);

            calendarDays.push({
                day,
                status: dayStatus,
                date: dateStr,
                isPast: this.isDateInPast(dateStr)
            });
        }

        return { calendarDays, firstDay, year, month };
    }

    // Get day status based on availability and appointments
    getDayStatus(dateStr, availability, appointments) {
        const isDoctorAvailable = availability.some(slot =>
            slot.dateAvailable === dateStr
        );

        if (!isDoctorAvailable) {
            return 'unavailable';
        }

        const dayAppointments = appointments.filter(apt =>
            apt.appointmentDate === dateStr
        );

        const totalSlots = 8; // 9am-4pm hourly
        const bookedSlots = dayAppointments.length;

        if (bookedSlots >= totalSlots) {
            return 'unavailable';
        } else if (bookedSlots > 0) {
            return 'partial';
        } else {
            return 'available';
        }
    }

    // Check if date is in the past
    isDateInPast(dateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(dateStr);
        return checkDate < today;
    }

    // Render calendar
    render() {
        if (!this.calendarData) return;

        const { calendarDays, firstDay, year, month } = this.calendarData;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];

        let html = '<div class="calendar-header">';
        html += `<div class="calendar-nav">`;
        html += `<button class="calendar-nav-btn" onclick="calendar.previousMonth()">‹</button>`;
        html += `<h3>${monthNames[month]} ${year}</h3>`;
        html += `<button class="calendar-nav-btn" onclick="calendar.nextMonth()">›</button>`;
        html += `</div></div>`;

        // Day name headers - UK format starts on Monday
        html += '<div class="calendar-grid">';
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => {
            html += `<div class="calendar-day-header">${d}</div>`;
        });

        // ensure format is Monday-Sunday
        const mondayFirstOffset = (firstDay + 6) % 7;
        for (let i = 0; i < mondayFirstOffset; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Calendar days
        calendarDays.forEach(dayData => {
            const isPast = dayData.isPast;
            const status = isPast ? 'past' : dayData.status;
            const selectedClass = dayData.date === this.selectedDate ? 'selected' : '';
            const clickable = !isPast && dayData.status !== 'unavailable' ? 'clickable' : '';

            html += `
                <div class="calendar-day ${status} ${selectedClass} ${clickable}"
                     data-date="${dayData.date}"
                     onclick="calendar.selectDate('${dayData.date}')"
                     title="${this.getDayTooltip(dayData)}">
                    ${dayData.day}
                </div>
            `;
        });

        html += '</div>';

        
        html += `
            <div class="calendar-legend">
                <span class="legend-item"><span class="legend-dot available"></span> Available</span>
                <span class="legend-item"><span class="legend-dot partial"></span> Partial</span>
                <span class="legend-item"><span class="legend-dot unavailable"></span> Full / Unavailable</span>
            </div>
        `;

        const calendarContainer = document.getElementById('calendar');
        if (calendarContainer) {
            calendarContainer.innerHTML = html;
        }
    }

  
    getDayTooltip(dayData) {
        if (dayData.isPast) return 'Past date';
        const statusText = {
            'available':   'Available - click to book',
            'partial':     'Partially booked - click to see times',
            'unavailable': 'Fully booked or unavailable'
        };
        return statusText[dayData.status] || '';
    }

    // Navigate to previous month
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.loadCalendarData().then(() => this.render());
    }

    // Navigate to next month
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.loadCalendarData().then(() => this.render());
    }

    // Select date
    async selectDate(dateStr) {
        if (this.isDateInPast(dateStr)) {
            this.showError('Cannot select past dates');
            return;
        }

        const dayData = this.calendarData?.calendarDays.find(d => d.date === dateStr);
        if (dayData?.status === 'unavailable') {
            this.showError('This date is fully booked or unavailable');
            return;
        }

        this.selectedDate = dateStr;
        this.render();

        if (window.onCalendarDateSelect) {
            await window.onCalendarDateSelect(dateStr);
        }
    }

    // Refresh calendar after booking
    async refresh() {
        await this.loadCalendarData();
        this.render();
    }

    // Show error
    showError(message) {
        if (window.showCalendarError) {
            window.showCalendarError(message);
        }
    }
}

// Global calendar instance
let calendar = null;

document.addEventListener('DOMContentLoaded', function() {
    calendar = new DoctorCalendar();
    window.calendar = calendar;
    window.refreshCalendar = () => calendar.refresh();
});
