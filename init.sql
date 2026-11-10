-- Smart Campus Facility Booking & Maintenance Platform Schema

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS maintenance_tickets CASCADE;
DROP TABLE IF EXISTS sensor_alerts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN', 'APPROVER', 'TECHNICIAN', 'STUDENT')),
    department VARCHAR(100),
    student_id VARCHAR(50)
);

-- 2. Facilities Table
CREATE TABLE facilities (
    facility_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL,
    capacity INT NOT NULL DEFAULT 30,
    location VARCHAR(100) NOT NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'MAINTENANCE_LOCK', 'IN_USE'))
);

-- 3. Bookings Table
CREATE TABLE bookings (
    booking_id VARCHAR(50) PRIMARY KEY,
    facility_id VARCHAR(50) NOT NULL REFERENCES facilities(facility_id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'IN_USE')),
    approver_id VARCHAR(50) REFERENCES users(user_id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sensor Alerts Table
CREATE TABLE sensor_alerts (
    alert_id VARCHAR(50) PRIMARY KEY,
    sensor_id VARCHAR(50) NOT NULL,
    metric VARCHAR(50) NOT NULL,
    reading NUMERIC(8,2) NOT NULL,
    threshold NUMERIC(8,2) NOT NULL,
    facility_id VARCHAR(50) NOT NULL REFERENCES facilities(facility_id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Maintenance Tickets Table
CREATE TABLE maintenance_tickets (
    ticket_id VARCHAR(50) PRIMARY KEY,
    facility_id VARCHAR(50) NOT NULL REFERENCES facilities(facility_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('HVAC', 'ELECTRICAL', 'NETWORK', 'GENERAL')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
    sla_deadline TIMESTAMPTZ NOT NULL,
    sla_hours INT NOT NULL DEFAULT 4,
    assigned_to VARCHAR(50) REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Audit Logs Table
CREATE TABLE audit_logs (
    log_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(50) REFERENCES users(user_id),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Users
INSERT INTO users (user_id, name, email, role, department, student_id) VALUES
('user-admin', 'Campus Administrator', 'admin@simats.edu.in', 'ADMIN', 'Campus Operations', NULL),
('user-karpagam', 'Dr. Karpagam', 'karpagam@simats.edu.in', 'APPROVER', 'IoT & Embedded Systems', NULL),
('user-sarah', 'Sarah Jenkins', 'sarah.hvac@simats.edu.in', 'TECHNICIAN', 'HVAC & Facilities', NULL),
('user-nirmal', 'Nirmal S', '192511249@simats.edu.in', 'STUDENT', 'Computer Science & Engineering', '192511249');

-- Seed Facilities
INSERT INTO facilities (facility_id, name, type, capacity, location, is_restricted, status) VALUES
('fac-seminar-main', 'Main Seminar Hall', 'SEMINAR_HALL', 300, 'Block A, 1st Floor', false, 'AVAILABLE'),
('fac-lab-101', 'IoT Embedded Systems Lab (Lab 101)', 'LAB', 40, 'Block C, Room 101', true, 'AVAILABLE'),
('fac-server-main', 'Server Room A', 'SERVER_ROOM', 5, 'Data Center, Basement', true, 'AVAILABLE');

-- Seed Sample Bookings
INSERT INTO bookings (booking_id, facility_id, user_id, title, start_time, end_time, status, approver_id, notes, created_at) VALUES
('bk-seed-001', 'fac-seminar-main', 'user-admin', 'Annual Technology & Innovation Summit', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '5 hours', 'CONFIRMED', 'user-admin', 'Approved campus-wide symposium with guest keynotes.', NOW() - INTERVAL '1 day'),
('bk-seed-002', 'fac-lab-101', 'user-nirmal', 'Edge AI Acceleration & Sensor Benchmark', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 3 hours', 'REQUESTED', NULL, 'Requires high-precision FPGA hardware and IoT sensor testbeds for student capstone evaluation.', NOW() - INTERVAL '2 hours');

-- Seed Initial Audit Logs
INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, details, created_at) VALUES
('FACILITY', 'fac-seminar-main', 'INITIALIZED', 'user-admin', '{"message": "Main Seminar Hall provisioned with capacity 300"}'::jsonb, NOW() - INTERVAL '2 days'),
('FACILITY', 'fac-lab-101', 'RESTRICTION_SET', 'user-admin', '{"message": "Designated as restricted research laboratory"}'::jsonb, NOW() - INTERVAL '2 days'),
('BOOKING', 'bk-seed-001', 'AUTO_CONFIRMED', 'user-admin', '{"status": "CONFIRMED", "facility": "fac-seminar-main"}'::jsonb, NOW() - INTERVAL '1 day'),
('BOOKING', 'bk-seed-002', 'REQUESTED_APPROVAL', 'user-nirmal', '{"status": "REQUESTED", "approver_assigned": "user-karpagam"}'::jsonb, NOW() - INTERVAL '2 hours');
