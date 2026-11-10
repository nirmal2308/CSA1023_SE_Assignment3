# Smart Campus Facility Booking and Maintenance Platform

**Course Code**: CSA1023 &bull; **Software Engineering Assignment 3**  
**Student Name**: Nirmal S &bull; **Register No**: 192511249 &bull; **Email**: 192511249@simats.edu.in  
**Repository Release**: `v1.0.0-stable`

---

## 📌 Executive Summary & Architecture Overview

The **Smart Campus Platform** is an enterprise-grade, containerized full-stack solution designed for autonomous university facility booking, high-concurrency race condition prevention, and edge IoT sensor maintenance triage.

### 🏛️ Technology Stack
- **Backend**: Node.js & Express (microservice cluster `app_a` on port 5001, `app_b` on port 5002)
- **Database**: PostgreSQL 15 (`campus_ops` database with persistent volume `smart_campus_pgdata`)
- **Reverse Proxy**: Nginx (Port 80 round-robin upstream load balancing with `proxy_next_upstream` failover)
- **Frontend**: Dark-mode glassmorphic dashboard (Tailwind CSS, Vanilla JS, real-time SLA clocks)
- **Testing & Tooling**: Playwright, Bash benchmark suites, PyAutoGUI, Docker Compose

```
[ Clients / Browsers / Edge Sensors ]
                │
                ▼
        [ Nginx Proxy: Port 80 ]
        (Round-Robin Load Balancer)
         /                      \
        ▼                        ▼
 [ App A : 5001 ]        [ App B : 5002 ]
 (Node.js Express)       (Node.js Express)
         \                      /
          ▼                    ▼
     [ PostgreSQL 15: Port 5432 (campus_ops) ]
     - Pessimistic Row Locking (SELECT FOR UPDATE)
     - Persistent Named Volume (smart_campus_pgdata)
```

---

## 🚀 Core Platform Capabilities

1. **Pessimistic Concurrency Control (`SELECT FOR UPDATE`)**:
   - Acquires exclusive row locks on facilities during booking checkout to eliminate double-booking race conditions.
   - Detects reservation overlaps and rejects conflicting requests with HTTP `409 Conflict` (`{ "error": "OVERLAPPING_RESERVATION" }`).
2. **Autonomous Telemetry Triage Engine**:
   - Ingests IoT temperature, vibration, and humidity spikes.
   - Server Room anomalies or temperatures $> 30^\circ\text{C}$ trigger automated `CRITICAL` 1-hour SLA emergency tickets assigned to HVAC technicians, instantly locking the facility from public reservation.
3. **High-Availability Zero-Downtime Failover**:
   - Nginx reverse proxy continuously load balances across application nodes with automated health retry.
   - Continuous ping test verifies 0% packet loss during live container restarts (`docker restart smart_campus_app_a`).
4. **Interactive 4-Tab Web Dashboard**:
   - **Tab 1: Facilities & Calendar**: Room catalogue cards, availability status, and 24-hour visual schedule.
   - **Tab 2: Telemetry Simulator**: Interactive edge sensor testbed with quick-incident presets.
   - **Tab 3: Maintenance Kanban**: Real-time SLA countdown timers, explainable triage rationales, and technician task progression.
   - **Tab 4: Department Approvals & Audit**: Faculty review queue for restricted research labs (Dr. Karpagam) and immutable PostgreSQL audit trail.

---

## 📸 Verified Execution Screenshots

All 10 required execution artifacts are captured and watermarked with **Nirmal S 192511249 CSA1023**:

| Artifact | Description | Location |
| :--- | :--- | :--- |
| `screenshot_3_1.png` | Web Dashboard: Facilities Catalogue & Calendar Grid | [`screenshots/screenshot_3_1.png`](screenshots/screenshot_3_1.png) |
| `screenshot_3_2.png` | Terminal: Sensor Telemetry Ingestion curl -> HTTP 201 Created | [`screenshots/screenshot_3_2.png`](screenshots/screenshot_3_2.png) |
| `screenshot_3_3.png` | Web Dashboard: Maintenance Kanban Queue & 1h SLA Countdown | [`screenshots/screenshot_3_3.png`](screenshots/screenshot_3_3.png) |
| `screenshot_3_4.png` | Web Dashboard: Department Approvals & Audit Trail Ledger | [`screenshots/screenshot_3_4.png`](screenshots/screenshot_3_4.png) |
| `screenshot_4_1.png` | Terminal: Git Branch Topology Graph & Release Tag `v1.0.0-stable` | [`screenshots/screenshot_4_1.png`](screenshots/screenshot_4_1.png) |
| `screenshot_4_2.png` | Terminal: Git Merge Conflict Markers & Resolved Diff | [`screenshots/screenshot_4_2.png`](screenshots/screenshot_4_2.png) |
| `screenshot_5_1.png` | Terminal: `docker compose up --build -d` & `docker compose ps` | [`screenshots/screenshot_5_1.png`](screenshots/screenshot_5_1.png) |
| `screenshot_5_2.png` | Terminal: Docker Restart & Database Volume Persistence Verification | [`screenshots/screenshot_5_2.png`](screenshots/screenshot_5_2.png) |
| `screenshot_6_1.png` | Terminal: Concurrency Row Lock Conflict Benchmark (201 vs 409) | [`screenshots/screenshot_6_1.png`](screenshots/screenshot_6_1.png) |
| `screenshot_6_2.png` | Terminal: Zero-Downtime Failover Benchmark (25 HTTP 200 OKs) | [`screenshots/screenshot_6_2.png`](screenshots/screenshot_6_2.png) |

---

## 🛠️ Quickstart & Local Deployment

### 1. Start the Stack
```bash
docker compose up --build -d
```
Verify all 4 containers (`smart_campus_db`, `smart_campus_app_a`, `smart_campus_app_b`, `smart_campus_proxy`) are healthy:
```bash
docker compose ps
```

### 2. Access Web Dashboard
Open your browser and navigate to:
```
http://localhost/
```

### 3. Run Automated Concurrency & Failover Tests
```bash
# Test pessimistic row locking race condition
bash scripts/test_concurrency.sh

# Test continuous failover and zero dropped requests
bash scripts/test_failover.sh
```

---

## 📄 Submission Documents
- **PDF Report 1**: `CO3-Assignment3-Answer_Nirmal S_192511249.pdf`
- **PDF Report 2**: `CO3-Assignment3-Word.pdf`
- **Word Document**: `Smart_Campus_Platform_Assignment3_Nirmal_192511249.docx`
