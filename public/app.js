// Smart Campus Client Application

let currentTickets = [];
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  // Poll health every 3 seconds to reflect active round-robin proxy instance
  setInterval(fetchHealth, 3000);
  // SLA countdown timer updater every 1 second
  countdownInterval = setInterval(updateAllSlaCounters, 1000);
});

async function initApp() {
  await fetchHealth();
  await loadFacilities();
  await loadBookings();
  await loadTickets();
  await loadAuditLogs();
}

// Tab Switching
function switchTab(tabName) {
  const tabs = ['facilities', 'simulator', 'kanban', 'approvals'];
  tabs.forEach(t => {
    const content = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (t === tabName) {
      content.classList.remove('hidden');
      btn.classList.add('active-tab', 'text-indigo-400');
      btn.classList.remove('text-slate-400');
    } else {
      content.classList.add('hidden');
      btn.classList.remove('active-tab', 'text-indigo-400');
      btn.classList.add('text-slate-400');
    }
  });

  if (tabName === 'kanban') loadTickets();
  if (tabName === 'approvals') loadBookings();
  if (tabName === 'facilities') {
    loadFacilities();
    loadBookings();
  }
}

// 1. Cluster Health & Active Node Polling
async function fetchHealth() {
  try {
    const res = await fetch('/api/v1/health');
    if (!res.ok) throw new Error('Health probe failed');
    const data = await res.json();
    const label = document.getElementById('active-instance-label');
    if (label) {
      label.textContent = data.instance || 'app_instance';
    }
  } catch (err) {
    const label = document.getElementById('active-instance-label');
    if (label) label.textContent = 'failover_pending';
  }
}

// 2. Load Facilities Catalogue
async function loadFacilities() {
  try {
    const res = await fetch('/api/v1/facilities');
    const data = await res.json();
    const facilities = data.facilities || [];

    const container = document.getElementById('facility-cards-container');
    if (!container) return;
    container.innerHTML = '';

    let maintenanceCount = 0;

    facilities.forEach(fac => {
      if (fac.status === 'MAINTENANCE_LOCK') maintenanceCount++;

      const isRestricted = fac.is_restricted;
      const isLocked = fac.status === 'MAINTENANCE_LOCK';

      let statusBadge = '';
      if (isLocked) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1"><i class="fa-solid fa-lock text-[10px]"></i><span>MAINTENANCE LOCK</span></span>`;
      } else if (isRestricted) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1"><i class="fa-solid fa-shield text-[10px]"></i><span>RESTRICTED ACCESS</span></span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1"><i class="fa-solid fa-circle-check text-[10px]"></i><span>AVAILABLE</span></span>`;
      }

      let iconClass = 'fa-building';
      if (fac.type === 'LAB') iconClass = 'fa-flask-vial';
      if (fac.type === 'SERVER_ROOM') iconClass = 'fa-server';

      const card = document.createElement('div');
      card.className = `bg-slate-900/70 border ${isLocked ? 'border-rose-500/50 ring-1 ring-rose-500/30' : 'border-slate-800'} rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all`;
      card.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-start justify-between">
            <div class="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
              <i class="fa-solid ${iconClass} text-lg"></i>
            </div>
            ${statusBadge}
          </div>

          <div>
            <h3 class="text-base font-bold text-white">${fac.name}</h3>
            <p class="text-xs text-slate-400 font-mono mt-0.5">ID: ${fac.facility_id} &bull; ${fac.location}</p>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs pt-1">
            <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
              <span class="text-slate-400">Capacity:</span>
              <p class="font-bold text-slate-200 mt-0.5">${fac.capacity} Persons</p>
            </div>
            <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
              <span class="text-slate-400">Active Bookings:</span>
              <p class="font-bold text-emerald-400 mt-0.5">${fac.active_bookings || 0} Registered</p>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-800/60 mt-4 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">
            ${isRestricted ? '<i class="fa-solid fa-user-check text-amber-400 mr-1"></i>Req. Dr. Karpagam Sign-off' : '<i class="fa-solid fa-bolt text-emerald-400 mr-1"></i>Instant Reservation'}
          </span>
          <button onclick="prefillBookingModal('${fac.facility_id}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${isLocked ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30'} transition-all" ${isLocked ? 'disabled' : ''}>
            ${isLocked ? 'Locked' : 'Book Room'}
          </button>
        </div>
      `;
      container.appendChild(card);
    });

    const mCountEl = document.getElementById('stat-maintenance-count');
    if (mCountEl) mCountEl.textContent = `${maintenanceCount} Locked`;

  } catch (err) {
    console.error('Failed to load facilities:', err);
  }
}

// 3. Load Bookings & Timeline Grid
async function loadBookings() {
  try {
    const res = await fetch('/api/v1/bookings');
    const data = await res.json();
    const bookings = data.bookings || [];

    // Update active stats
    const activeEl = document.getElementById('stat-active-bookings');
    if (activeEl) activeEl.textContent = `${bookings.length} Slots`;

    // Render Timeline
    const timeline = document.getElementById('calendar-timeline');
    if (timeline) {
      timeline.innerHTML = '';
      bookings.forEach(b => {
        const start = new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isPending = b.status === 'REQUESTED';
        const isConfirmed = b.status === 'CONFIRMED';

        let badgeColor = isConfirmed ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30';

        const row = document.createElement('div');
        row.className = 'bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs';
        row.innerHTML = `
          <div class="flex items-center space-x-3">
            <div class="px-2.5 py-1.5 rounded-lg font-mono font-bold ${badgeColor} border text-center">
              ${b.status}
            </div>
            <div>
              <p class="font-bold text-white text-sm">${b.title}</p>
              <p class="text-slate-400 font-mono">${b.facility_name} &bull; Booked by: ${b.user_name} (${b.student_id || b.user_role})</p>
            </div>
          </div>
          <div class="flex items-center space-x-3 text-right">
            <div class="font-mono text-slate-300">
              <i class="fa-regular fa-clock text-indigo-400 mr-1"></i>${start} &ndash; ${end}
            </div>
          </div>
        `;
        timeline.appendChild(row);
      });
    }

    // Render Approvals Tab
    const approvalsContainer = document.getElementById('approvals-container');
    const pendingBadge = document.getElementById('badge-pending-count');
    const pendingBookings = bookings.filter(b => b.status === 'REQUESTED');
    if (pendingBadge) pendingBadge.textContent = pendingBookings.length;

    if (approvalsContainer) {
      approvalsContainer.innerHTML = '';
      if (pendingBookings.length === 0) {
        approvalsContainer.innerHTML = `
          <div class="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-sm">
            <i class="fa-solid fa-circle-check text-emerald-400 text-2xl mb-2"></i>
            <p>No pending restricted approvals required at this time.</p>
          </div>
        `;
      } else {
        pendingBookings.forEach(b => {
          const card = document.createElement('div');
          card.className = 'bg-slate-900/80 border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-4';
          card.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div class="flex items-center space-x-3">
                <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ACTION REQUIRED
                </span>
                <span class="text-xs text-slate-400 font-mono">Reference: ${b.booking_id}</span>
              </div>
              <span class="text-xs text-slate-400 font-mono"><i class="fa-regular fa-calendar mr-1"></i>${new Date(b.created_at).toLocaleString()}</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-slate-400 font-semibold uppercase">Restricted Target Space</p>
                <h4 class="text-base font-bold text-white mt-0.5">${b.facility_name}</h4>
                <p class="text-xs text-slate-400 font-mono mt-0.5">Location: ${b.facility_location || 'Campus Tech Block'}</p>
              </div>

              <div>
                <p class="text-xs text-slate-400 font-semibold uppercase">Student Requester</p>
                <h4 class="text-base font-bold text-white mt-0.5">${b.user_name}</h4>
                <p class="text-xs text-indigo-400 font-mono mt-0.5">Student ID: ${b.student_id || '192511249'} &bull; CSE Department</p>
              </div>
            </div>

            <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-200">Proposed Research Scope:</span>
                <span class="font-mono text-indigo-400">${b.title}</span>
              </div>
              <p class="text-slate-300 leading-relaxed">${b.notes || 'No extra notes provided.'}</p>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div class="text-xs text-slate-400 flex items-center space-x-2">
                <i class="fa-solid fa-triangle-exclamation text-amber-400"></i>
                <span>Reviewing Faculty: <strong>Dr. Karpagam</strong></span>
              </div>
              <div class="flex items-center space-x-3">
                <button onclick="reviewBooking('${b.booking_id}', 'reject')" class="px-4 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-xs rounded-lg transition-all flex items-center space-x-1.5">
                  <i class="fa-solid fa-xmark"></i>
                  <span>Reject Request</span>
                </button>
                <button onclick="reviewBooking('${b.booking_id}', 'approve')" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-1.5">
                  <i class="fa-solid fa-check"></i>
                  <span>Approve & Lock Slot</span>
                </button>
              </div>
            </div>
          `;
          approvalsContainer.appendChild(card);
        });
      }
    }

  } catch (err) {
    console.error('Failed to load bookings:', err);
  }
}

// 4. Load Maintenance Tickets & Kanban Queue
async function loadTickets() {
  try {
    const res = await fetch('/api/v1/tickets');
    const data = await res.json();
    currentTickets = data.tickets || [];

    const badge = document.getElementById('badge-tickets-count');
    if (badge) badge.textContent = currentTickets.filter(t => t.status === 'OPEN').length;

    const colOpen = document.getElementById('kanban-col-open');
    const colProgress = document.getElementById('kanban-col-progress');
    const colResolved = document.getElementById('kanban-col-resolved');

    if (!colOpen || !colProgress || !colResolved) return;

    colOpen.innerHTML = '';
    colProgress.innerHTML = '';
    colResolved.innerHTML = '';

    let countOpen = 0;
    let countProgress = 0;
    let countResolved = 0;

    currentTickets.forEach(ticket => {
      const isCritical = ticket.severity === 'CRITICAL';
      const isHvac = ticket.category === 'HVAC';

      const card = document.createElement('div');
      card.id = `ticket-card-${ticket.ticket_id}`;
      card.className = `bg-slate-950/90 border ${isCritical ? 'border-rose-500/80 ticket-critical-card' : 'border-slate-800'} rounded-xl p-4 shadow-lg space-y-3 transition-all`;

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${isCritical ? 'bg-rose-500/20 text-rose-300 border border-rose-500/60' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
              ${ticket.severity}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
              ${ticket.category}
            </span>
          </div>
          <span class="text-[11px] font-mono text-slate-500">${ticket.ticket_id}</span>
        </div>

        <div>
          <h4 class="text-sm font-bold text-white">${ticket.title}</h4>
          <p class="text-xs text-slate-400 font-mono mt-0.5"><i class="fa-solid fa-location-dot text-indigo-400 mr-1"></i>${ticket.facility_name}</p>
        </div>

        <!-- SLA Live Countdown -->
        <div class="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400 font-medium"><i class="fa-solid fa-stopwatch text-rose-400 mr-1"></i>SLA Countdown:</span>
            <span id="sla-countdown-${ticket.ticket_id}" class="font-mono font-bold text-rose-300">Calculating...</span>
          </div>
          <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div id="sla-bar-${ticket.ticket_id}" class="bg-gradient-to-r from-rose-500 to-amber-500 h-1.5 rounded-full sla-progress-fill" style="width: 85%;"></div>
          </div>
        </div>

        <!-- Explainable Machine Triage Rationale -->
        <div class="bg-rose-950/20 border border-rose-800/40 rounded-lg p-2.5 text-[11px] text-rose-200/90 leading-relaxed font-sans">
          <div class="flex items-center space-x-1.5 font-bold text-rose-400 mb-1">
            <i class="fa-solid fa-brain text-xs"></i>
            <span>Autonomous Triage Rationale:</span>
          </div>
          <p>${ticket.rationale}</p>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
          <div class="flex items-center space-x-1.5 text-slate-400">
            <i class="fa-solid fa-user-gear text-slate-500"></i>
            <span>${ticket.assignee_name || 'Sarah Jenkins (HVAC)'}</span>
          </div>

          <div class="flex items-center space-x-2">
            ${ticket.status === 'OPEN' ? `
              <button onclick="updateTicketStatus('${ticket.ticket_id}', 'IN_PROGRESS')" class="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/30 text-amber-300 hover:text-white rounded-md text-[11px] font-semibold transition-all">
                Start Triage
              </button>
            ` : ''}
            ${ticket.status === 'IN_PROGRESS' || ticket.status === 'OPEN' ? `
              <button onclick="updateTicketStatus('${ticket.ticket_id}', 'RESOLVED')" class="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white rounded-md text-[11px] font-semibold transition-all">
                Resolve
              </button>
            ` : ''}
          </div>
        </div>
      `;

      if (ticket.status === 'OPEN') {
        colOpen.appendChild(card);
        countOpen++;
      } else if (ticket.status === 'IN_PROGRESS') {
        colProgress.appendChild(card);
        countProgress++;
      } else if (ticket.status === 'RESOLVED') {
        colResolved.appendChild(card);
        countResolved++;
      }
    });

    document.getElementById('kanban-open-count').textContent = countOpen;
    document.getElementById('kanban-progress-count').textContent = countProgress;
    document.getElementById('kanban-resolved-count').textContent = countResolved;

    updateAllSlaCounters();

  } catch (err) {
    console.error('Failed to load tickets:', err);
  }
}

// SLA Live Dynamic Calculation
function updateAllSlaCounters() {
  if (!currentTickets || currentTickets.length === 0) return;

  currentTickets.forEach(ticket => {
    const el = document.getElementById(`sla-countdown-${ticket.ticket_id}`);
    const bar = document.getElementById(`sla-bar-${ticket.ticket_id}`);
    if (!el) return;

    if (ticket.status === 'RESOLVED') {
      el.textContent = 'COMPLETED / SLA MET';
      el.className = 'font-mono font-bold text-emerald-400';
      if (bar) bar.style.width = '100%';
      return;
    }

    const deadline = new Date(ticket.sla_deadline).getTime();
    const now = Date.now();
    const diff = deadline - now;

    if (diff <= 0) {
      el.textContent = '00h 00m 00s (BREACHED)';
      el.className = 'font-mono font-bold text-rose-500 animate-pulse';
      if (bar) bar.style.width = '0%';
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(mins).padStart(2, '0');
      const sStr = String(secs).padStart(2, '0');

      el.textContent = `${hStr}h ${mStr}m ${sStr}s Remaining`;

      // Percentage remaining assuming 1 hour (3600s) default
      const totalSeconds = (ticket.sla_hours || 1) * 3600;
      const pct = Math.max(0, Math.min(100, Math.round((diff / 1000 / totalSeconds) * 100)));
      if (bar) bar.style.width = `${pct}%`;
    }
  });
}

// Update Ticket Status
async function updateTicketStatus(ticketId, status) {
  try {
    const res = await fetch(`/api/v1/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, performedBy: 'user-sarah' }),
    });
    if (res.ok) {
      await loadTickets();
      await loadFacilities();
      await loadAuditLogs();
    }
  } catch (err) {
    alert('Failed to update ticket status: ' + err.message);
  }
}

// 5. Approvals Review (Dr. Karpagam)
async function reviewBooking(bookingId, decision) {
  try {
    const endpoint = decision === 'approve' ? `/api/v1/bookings/${bookingId}/approve` : `/api/v1/bookings/${bookingId}/reject`;
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverId: 'user-karpagam' }),
    });

    if (res.ok) {
      await loadBookings();
      await loadFacilities();
      await loadAuditLogs();
    } else {
      const err = await res.json();
      alert(`Approval error: ${err.error || 'Failed'}`);
    }
  } catch (err) {
    alert(`Request error: ${err.message}`);
  }
}

// 6. Audit Trail Ledger
async function loadAuditLogs() {
  try {
    const res = await fetch('/api/v1/audit-logs');
    const data = await res.json();
    const rows = document.getElementById('audit-trail-rows');
    if (!rows) return;

    rows.innerHTML = '';
    const logs = data.logs || [];

    logs.slice(0, 15).forEach(l => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition-colors';

      let entityBadge = 'text-indigo-400 bg-indigo-950/60 border border-indigo-800/80';
      if (l.entity_type === 'TICKET') entityBadge = 'text-rose-400 bg-rose-950/60 border border-rose-800/80';
      if (l.entity_type === 'SENSOR') entityBadge = 'text-amber-400 bg-amber-950/60 border border-amber-800/80';
      if (l.entity_type === 'FACILITY') entityBadge = 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/80';

      const detailsStr = typeof l.details === 'object' ? JSON.stringify(l.details) : l.details;

      tr.innerHTML = `
        <td class="py-2.5 font-bold text-slate-400">#${l.log_id}</td>
        <td class="py-2.5 text-slate-400">${new Date(l.created_at).toLocaleTimeString()}</td>
        <td class="py-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${entityBadge}">${l.entity_type}</span></td>
        <td class="py-2.5 font-bold text-white">${l.action}</td>
        <td class="py-2.5 text-slate-300">${l.user_name || l.performed_by || 'SYSTEM'}</td>
        <td class="py-2.5 text-slate-400 truncate max-w-xs" title="${detailsStr}">${detailsStr}</td>
      `;
      rows.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load audit logs:', err);
  }
}

// 7. Sensor Telemetry Dispatch
function setTelemetryPreset(sensorId, metric, reading, threshold, facilityId) {
  document.getElementById('sim-sensor-id').value = sensorId;
  document.getElementById('sim-metric').value = metric;
  document.getElementById('sim-threshold').value = threshold;
  document.getElementById('sim-facility-id').value = facilityId;
  document.getElementById('sim-reading-val').value = reading;
  document.getElementById('sim-reading-slider').value = reading;
  document.getElementById('reading-display').textContent = reading + ' °C';
}

async function submitTelemetryAlert() {
  const sensorId = document.getElementById('sim-sensor-id').value;
  const metric = document.getElementById('sim-metric').value;
  const reading = parseFloat(document.getElementById('sim-reading-val').value);
  const threshold = parseFloat(document.getElementById('sim-threshold').value);
  const facilityId = document.getElementById('sim-facility-id').value;

  const badge = document.getElementById('response-status-badge');
  const output = document.getElementById('sim-response-output');

  badge.textContent = 'DISPATCHING...';
  badge.className = 'px-2 py-0.5 rounded text-[10px] bg-indigo-900 text-indigo-300';

  const payload = { sensorId, metric, reading, threshold, facilityId };

  try {
    const res = await fetch('/api/v1/sensors/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const status = res.status;
    const data = await res.json();

    badge.textContent = `HTTP ${status} CREATED`;
    badge.className = 'px-2 py-0.5 rounded text-[10px] bg-emerald-900 text-emerald-300 font-bold';

    output.innerHTML = `
      <div class="text-emerald-400 font-bold">&gt; POST /api/v1/sensors/alerts HTTP 201 Created</div>
      <pre class="text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-[11px] overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>
      <div class="text-xs text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-900/40">
        <strong>Triage Result:</strong> Dispatched ticket ${data.ticket?.ticket_id} with ${data.ticket?.severity} priority to technician Sarah.
      </div>
    `;

    // Immediately sync tickets, facilities, and audit
    await loadTickets();
    await loadFacilities();
    await loadAuditLogs();

  } catch (err) {
    badge.textContent = 'ERROR';
    badge.className = 'px-2 py-0.5 rounded text-[10px] bg-rose-900 text-rose-300 font-bold';
    output.innerHTML = `<span class="text-rose-400">Failed to dispatch telemetry alert: ${err.message}</span>`;
  }
}

// 8. Modal & Booking Creation
function openBookingModal() {
  document.getElementById('booking-modal').classList.remove('hidden');
  const now = new Date();
  const start = new Date(now.getTime() + 3600 * 1000).toISOString().slice(0, 16);
  const end = new Date(now.getTime() + 3600 * 3000).toISOString().slice(0, 16);
  document.getElementById('modal-start-time').value = start;
  document.getElementById('modal-end-time').value = end;
  document.getElementById('modal-error-msg').classList.add('hidden');
}

function prefillBookingModal(facilityId) {
  openBookingModal();
  document.getElementById('modal-facility-id').value = facilityId;
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.add('hidden');
}

async function submitNewBooking(e) {
  e.preventDefault();
  const facilityId = document.getElementById('modal-facility-id').value;
  const userId = document.getElementById('modal-user-id').value;
  const title = document.getElementById('modal-title').value;
  const startTime = new Date(document.getElementById('modal-start-time').value).toISOString();
  const endTime = new Date(document.getElementById('modal-end-time').value).toISOString();
  const notes = document.getElementById('modal-notes').value;

  const errEl = document.getElementById('modal-error-msg');
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/v1/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, userId, title, startTime, endTime, notes }),
    });

    const data = await res.json();
    if (res.status === 201) {
      closeBookingModal();
      await loadBookings();
      await loadFacilities();
      await loadAuditLogs();
    } else {
      errEl.textContent = `Reservation Error (${data.error || 'Conflict'}): ${data.message || 'Unable to book'}`;
      errEl.classList.remove('hidden');
    }
  } catch (err) {
    errEl.textContent = `Network / Execution Error: ${err.message}`;
    errEl.classList.remove('hidden');
  }
}
