const db = require('../config/database');

/**
 * Base Booking Controller for Smart Campus Platform
 */

// POST /api/v1/bookings
async function createBooking(req, res) {
  const { facilityId, userId, title, startTime, endTime, notes } = req.body;

  if (!facilityId || !userId || !startTime || !endTime) {
    return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Section: Pessimistic Row Locking & Concurrency Control
    // [FEATURE: CONCURRENCY-LOCKING] Acquire exclusive row lock on facility to serialize simultaneous reservations
    const facilityRes = await client.query('SELECT * FROM facilities WHERE facility_id = $1 FOR UPDATE', [facilityId]);
    if (facilityRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'FACILITY_NOT_FOUND' });
    }
    const facility = facilityRes.rows[0];

    // Concurrency serialization delay window (300ms) for race condition simulation
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Check time overlaps
    const overlapRes = await client.query(
      `SELECT * FROM bookings 
       WHERE facility_id = $1 
         AND status IN ('CONFIRMED','IN_USE','REQUESTED') 
         AND (start_time < $3 AND end_time > $2)`,
      [facilityId, startTime, endTime]
    );

    if (overlapRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'OVERLAPPING_RESERVATION',
        message: 'Requested time slot conflicts with an existing reservation.',
      });
    }

    // Determine status: restricted requires faculty sign-off
    const status = facility.is_restricted ? 'REQUESTED' : 'CONFIRMED';
    const bookingId = `bk-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;

    const insertRes = await client.query(
      `INSERT INTO bookings (booking_id, facility_id, user_id, title, start_time, end_time, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [bookingId, facilityId, userId, title, startTime, endTime, status, notes || '']
    );

    // Audit Log
    await client.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, details)
       VALUES ('BOOKING', $1, $2, $3, $4)`,
      [bookingId, status === 'CONFIRMED' ? 'AUTO_CONFIRMED' : 'RESERVATION_REQUESTED', userId, JSON.stringify({ facility_id: facilityId, start_time: startTime, end_time: endTime })]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, booking: insertRes.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BOOKING CONTROLLER ERROR] createBooking:', err.message);
    return res.status(500).json({ error: 'BOOKING_FAILED', details: err.message });
  } finally {
    client.release();
  }
}

// GET /api/v1/bookings
async function listBookings(req, res) {
  try {
    const query = `
      SELECT 
        b.booking_id,
        b.facility_id,
        f.name AS facility_name,
        f.location AS facility_location,
        f.is_restricted,
        b.user_id,
        u.name AS user_name,
        u.role AS user_role,
        u.student_id,
        b.title,
        b.start_time,
        b.end_time,
        b.status,
        b.notes,
        b.created_at
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.facility_id
      JOIN users u ON b.user_id = u.user_id
      ORDER BY b.start_time ASC;
    `;
    const result = await db.query(query);
    return res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error('[BOOKING CONTROLLER ERROR] listBookings:', err.message);
    return res.status(500).json({ error: 'FETCH_BOOKINGS_FAILED', details: err.message });
  }
}

// PATCH /api/v1/bookings/:id/approve
async function approveBooking(req, res) {
  const { id } = req.params;
  const { approverId = 'user-karpagam' } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE bookings 
       SET status = 'CONFIRMED', approver_id = $1 
       WHERE booking_id = $2 
       RETURNING *`,
      [approverId, id]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
    }

    await client.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, details)
       VALUES ('BOOKING', $1, 'APPROVED_BY_FACULTY', $2, $3)`,
      [id, approverId, JSON.stringify({ booking_id: id, decision: 'APPROVED' })]
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true, booking: updateRes.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'APPROVE_FAILED', details: err.message });
  } finally {
    client.release();
  }
}

// PATCH /api/v1/bookings/:id/reject
async function rejectBooking(req, res) {
  const { id } = req.params;
  const { approverId = 'user-karpagam' } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE bookings 
       SET status = 'REJECTED', approver_id = $1 
       WHERE booking_id = $2 
       RETURNING *`,
      [approverId, id]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
    }

    await client.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, details)
       VALUES ('BOOKING', $1, 'REJECTED_BY_FACULTY', $2, $3)`,
      [id, approverId, JSON.stringify({ booking_id: id, decision: 'REJECTED' })]
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true, booking: updateRes.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'REJECT_FAILED', details: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  createBooking,
  listBookings,
  approveBooking,
  rejectBooking,
};
