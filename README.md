# HospitalDB Medical Portal

A patient-focused hospital system developed using Agile Scrum. The application provides secure authentication, role-based access, and core healthcare functionality including appointment booking and medical record access using Supabase.

## Features

- User authentication (patients and doctors)
- Role-based dashboards
- Appointment booking, rescheduling, and cancellation
- Medical records access
- Doctor availability calendar
- Database integration with Supabase

## Tech Stack

- Frontend: HTML, CSS, JavaScript  
- Backend: Supabase (PostgreSQL + Auth)  
- Security: Row Level Security (RLS)  
- Deployment: GitHub Pages  

## Security

- Supabase authentication with secure session management  
- Row Level Security to restrict data access  
- Role-based access control (patient vs doctor)  
- Users can only access their own data  

## Architecture

- Frontend handles UI and user interaction  
- Supabase provides authentication and database services  
- Role-based logic controls access to features and data  

## Setup

- Ready to deploy via GitHub Pages  
- Demo credentials are hardcoded  
- Database security is enforced via RLS policies  

## Notes

- Doctor dashboard is implemented as a prototype to demonstrate role-based access  
- Core functionality is focused on patient features as required by the assignment  

## Assignment Context

This project was developed over three sprints using Agile Scrum methodology as part of a Software Engineering module. Core features implemented include authentication, appointment booking, doctor availability, and secure medical record access.

## 🎥 Demonstration Video

A full demonstration of the system, including authentication, appointment booking, calendar functionality, and security features, can be accessed here:

https://drive.google.com/file/d/1se76GZVqov-KWXlZEVplKVlliUYLD0yI/view?usp=sharing
