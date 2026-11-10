const db = require('../config/database');

// GET /api/v1/tickets
async function listTickets(req, res) {
  try {
    const query = `
      SELECT 
        t.ticket_id,
        t.facility_id,
        f.name AS facility_name,
        f.type AS facility_type,
        t.category,
        t.severity,
        t.title,
        t.description,
        t.rationale,
        t.status,
        t.sla_deadline,
        t.sla_hours,
        t.assigned_to,
        u.name AS assignee_name,
        t.created_at,
        t.updated_at
      FROM maintenance_tickets t
      JOIN facilities f ON t.facility_id = f.facility_id
      LEFT JOIN users u ON t.assigned_to = u.user_id
      ORDER BY 
        CASE 
          WHEN t.severity = 'CRITICAL' THEN 1
          WHEN t.severity = 'HIGH' THEN 2
          WHEN t.severity = 'MEDIUM' THEN 3
          ELSE 4
        END,
        t.created_at DESC;
    `;
    const result = await db.query(query);
    return res.status(200).json({ tickets: result.rows });
  } catch (err) {
    console.error('[TICKET CONTROLLER ERROR] listTickets:', err.message);
    return res.status(500).json({ error: 'FAILED_TO_FETCH_TICKETS', details: err.message });
  }
}

// PATCH /api/v1/tickets/:id/status
async function updateTicketStatus(req, res) {
  const { id } = req.params;
  const { status, performedBy = 'user-sarah' } = req.body;

  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
    return res.status(400).json({ error: 'INVALID_STATUS' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE maintenance_tickets 
       SET status = $1, updated_at = NOW() 
       WHERE ticket_id = $2 
       RETURNING *`,
      [status, id]
    );

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'TICKET_NOT_FOUND' });
    }

    const ticket = updateRes.rows[0];

    // If ticket is resolved, check if any open critical tickets remain for this facility
    if (status === 'RESOLVED') {
      const openCritical = await client.query(
        `SELECT COUNT(*) FROM maintenance_tickets 
         WHERE facility_id = $1 AND status != 'RESOLVED' AND severity = 'CRITICAL'`,
        [ticket.facility_id]
      );

      if (parseInt(openCritical.rows[0].count, 10) === 0) {
        await client.query(
          `UPDATE facilities SET status = 'AVAILABLE' WHERE facility_id = $1`,
          [ticket.facility_id]
        );
      }
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, details)
       VALUES ('TICKET', $1, 'STATUS_UPDATE', $2, $3)`,
      [id, performedBy, JSON.stringify({ new_status: status, ticket_id: id })]
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true, ticket });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[TICKET CONTROLLER ERROR] updateTicketStatus:', err.message);
    return res.status(500).json({ error: 'UPDATE_FAILED', details: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  listTickets,
  updateTicketStatus,
};
