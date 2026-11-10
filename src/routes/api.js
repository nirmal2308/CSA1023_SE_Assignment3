const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bookingController = require('../controllers/bookingController');
const sensorController = require('../controllers/sensorController');
const ticketController = require('../controllers/ticketController');

// 1. Healthcheck Endpoint
router.get('/health', async (req, res) => {
  try {
    const dbCheck = await db.query('SELECT 1 AS alive');
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      instance: process.env.INSTANCE_NAME || 'app_instance_unknown',
      database: dbCheck.rows.length ? 'HEALTHY' : 'UNREACHABLE',
    });
  } catch (err) {
    res.status(503).json({
      status: 'DEGRADED',
      timestamp: new Date().toISOString(),
      instance: process.env.INSTANCE_NAME || 'app_instance_unknown',
      error: err.message,
    });
  }
});

// 2. Facilities Endpoints
router.get('/facilities', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        f.*,
        (SELECT COUNT(*) FROM bookings b WHERE b.facility_id = f.facility_id AND b.status IN ('CONFIRMED','IN_USE')) AS active_bookings,
        (SELECT COUNT(*) FROM maintenance_tickets t WHERE t.facility_id = f.facility_id AND t.status != 'RESOLVED') AS open_tickets
      FROM facilities f
      ORDER BY f.name ASC;
    `);
    res.status(200).json({ facilities: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_FACILITIES', details: err.message });
  }
});

// 3. Bookings Endpoints
router.get('/bookings', bookingController.listBookings);
router.post('/bookings', bookingController.createBooking);
router.patch('/bookings/:id/approve', bookingController.approveBooking);
router.patch('/bookings/:id/reject', bookingController.rejectBooking);

// 4. Sensors & Alerts Endpoints
router.post('/sensors/alerts', sensorController.createAlert);
router.get('/sensors/alerts', sensorController.listAlerts);

// 5. Maintenance Tickets Endpoints
router.get('/tickets', ticketController.listTickets);
router.patch('/tickets/:id/status', ticketController.updateTicketStatus);

// 6. Audit Logs Endpoints
router.get('/audit-logs', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.name AS user_name, u.role AS user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.performed_by = u.user_id
      ORDER BY a.created_at DESC
      LIMIT 100;
    `);
    res.status(200).json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'FAILED_TO_LOAD_AUDIT_LOGS', details: err.message });
  }
});

module.exports = router;
