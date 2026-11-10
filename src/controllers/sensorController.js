const db = require('../config/database');
const triageEngine = require('../services/triageEngine');

// POST /api/v1/sensors/alerts
async function createAlert(req, res) {
  const { sensorId, metric, reading, threshold, facilityId } = req.body;

  if (!sensorId || !metric || reading === undefined || threshold === undefined || !facilityId) {
    return res.status(400).json({ error: 'MISSING_REQUIRED_ALERT_FIELDS' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Facility Details
    const facilityRes = await client.query('SELECT * FROM facilities WHERE facility_id = $1', [facilityId]);
    if (facilityRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'FACILITY_NOT_FOUND' });
    }
    const facility = facilityRes.rows[0];

    // 2. Automated Triage Engine Evaluation
    const triage = triageEngine.evaluateTelemetry({
      sensorId,
      metric,
      reading,
      threshold,
      facilityId,
      facilityType: facility.type,
      facilityName: facility.name,
    });

    const alertId = `alt-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
    const ticketId = `tck-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;

    // 3. Insert Sensor Alert
    const alertInsert = await client.query(
      `INSERT INTO sensor_alerts (alert_id, sensor_id, metric, reading, threshold, facility_id, severity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
       RETURNING *`,
      [alertId, sensorId, metric, reading, threshold, facilityId, triage.severity]
    );

    // 4. Create Automated Maintenance Ticket (assigned to Sarah - HVAC Tech)
    const ticketInsert = await client.query(
      `INSERT INTO maintenance_tickets 
       (ticket_id, facility_id, category, severity, title, description, rationale, status, sla_deadline, sla_hours, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, 'user-sarah')
       RETURNING *`,
      [
        ticketId,
        facilityId,
        triage.category,
        triage.severity,
        triage.title,
        triage.description,
        triage.rationale,
        triage.slaDeadline,
        triage.slaHours,
      ]
    );

    // 5. If Critical, Lock Facility from Future Bookings
    if (triage.requiresMaintenanceLock) {
      await client.query(
        `UPDATE facilities SET status = 'MAINTENANCE_LOCK' WHERE facility_id = $1`,
        [facilityId]
      );
    }

    // 6. Record Audit Log Entry
    await client.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, details)
       VALUES ('SENSOR', $1, 'TELEMETRY_SPIKE_TRIAGED', 'user-sarah', $2)`,
      [
        sensorId,
        JSON.stringify({
          metric,
          reading,
          threshold,
          severity: triage.severity,
          ticket_id: ticketId,
          sla_hours: triage.slaHours,
          facility_id: facilityId,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      status: 'ALERT_PROCESSED',
      alert: alertInsert.rows[0],
      ticket: ticketInsert.rows[0],
      facilityStatus: triage.requiresMaintenanceLock ? 'MAINTENANCE_LOCK' : facility.status,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SENSOR CONTROLLER ERROR] createAlert:', err.message);
    return res.status(500).json({ error: 'TELEMETRY_INTAKE_FAILED', details: err.message });
  } finally {
    client.release();
  }
}

// GET /api/v1/sensors/alerts
async function listAlerts(req, res) {
  try {
    const result = await db.query(`
      SELECT 
        a.*,
        f.name AS facility_name
      FROM sensor_alerts a
      JOIN facilities f ON a.facility_id = f.facility_id
      ORDER BY a.created_at DESC
      LIMIT 50;
    `);
    return res.status(200).json({ alerts: result.rows });
  } catch (err) {
    console.error('[SENSOR CONTROLLER ERROR] listAlerts:', err.message);
    return res.status(500).json({ error: 'FETCH_ALERTS_FAILED', details: err.message });
  }
}

module.exports = {
  createAlert,
  listAlerts,
};
