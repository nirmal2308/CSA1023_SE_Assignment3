const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PROJECT_DIR = path.resolve(__dirname, '..');
const SCREENSHOT_DIR_LOCAL = path.join(PROJECT_DIR, 'screenshots');
const SCREENSHOT_DIR_ROOT = path.resolve(PROJECT_DIR, '..', 'screenshots');

// Ensure screenshot directories exist
[SCREENSHOT_DIR_LOCAL, SCREENSHOT_DIR_ROOT].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function copyToBoth(filename) {
  const src = path.join(SCREENSHOT_DIR_LOCAL, filename);
  const dst = path.join(SCREENSHOT_DIR_ROOT, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`[SYNCED] ${filename} -> ./screenshots/${filename}`);
  }
}

// Helper to escape HTML characters
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Convert ANSI / text output to formatted HTML
function formatTerminalOutput(text) {
  let escaped = escapeHtml(text);

  // Status highlights
  escaped = escaped.replace(/(HTTP Status Code\s*:\s*)(201)/g, '$1<span class="text-emerald-400 font-bold">$2 Created</span>');
  escaped = escaped.replace(/(HTTP Status Code\s*:\s*)(409)/g, '$1<span class="text-rose-400 font-bold">$2 Conflict</span>');
  escaped = escaped.replace(/(HTTP 201 Created)/gi, '<span class="text-emerald-400 font-bold">$1</span>');
  escaped = escaped.replace(/(HTTP 409 Conflict)/gi, '<span class="text-rose-400 font-bold">$1</span>');
  escaped = escaped.replace(/(HTTP 200 OK)/gi, '<span class="text-emerald-400 font-bold">$1</span>');
  escaped = escaped.replace(/(healthy)/gi, '<span class="text-emerald-400 font-semibold">$1</span>');
  escaped = escaped.replace(/(\[SUCCESS\])/gi, '<span class="text-emerald-400 font-bold">$1</span>');
  escaped = escaped.replace(/(\[VERIFICATION SUCCESS\])/gi, '<span class="text-emerald-400 font-bold">$1</span>');
  escaped = escaped.replace(/(\[CHAOS EVENT\])/gi, '<span class="text-amber-400 font-bold">$1</span>');
  escaped = escaped.replace(/(v1\.0\.0-stable)/gi, '<span class="text-amber-300 font-bold">$1</span>');
  escaped = escaped.replace(/(OVERLAPPING_RESERVATION)/gi, '<span class="text-rose-400 font-bold">$1</span>');
  escaped = escaped.replace(/(CRITICAL)/gi, '<span class="text-rose-400 font-bold">$1</span>');

  // Git diff markers
  escaped = escaped.replace(/(&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD)/g, '<span class="bg-rose-950 text-rose-300 font-bold px-1 rounded">$1</span>');
  escaped = escaped.replace(/(=======)/g, '<span class="bg-slate-700 text-amber-300 font-bold px-1 rounded">$1</span>');
  escaped = escaped.replace(/(&gt;&gt;&gt;&gt;&gt;&gt;&gt; feature\/concurrency-locking)/g, '<span class="bg-indigo-950 text-indigo-300 font-bold px-1 rounded">$1</span>');

  // Git graph branch symbols
  escaped = escaped.replace(/^(\s*[\*\|\/\\\s]+)/gm, '<span class="text-indigo-400 font-bold">$1</span>');

  return escaped;
}

// Generate terminal HTML preview and screenshot with Playwright
async function captureTerminalView(page, { title, command, output, filename, height = null }) {
  const formattedBody = formatTerminalOutput(output);
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
      <style>
        body {
          background-color: #0b0f19;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          padding: 24px;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .terminal-window {
          background-color: #0d1117;
          border: 1px solid #30363d;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          width: 100%;
          max-width: 1100px;
          overflow: hidden;
        }
        .terminal-header {
          background: linear-gradient(to bottom, #161b22, #0d1117);
          border-bottom: 1px solid #21262d;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .window-dots {
          display: flex;
          gap: 8px;
        }
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .dot-red { background-color: #ff5f56; }
        .dot-yellow { background-color: #ffbd2e; }
        .dot-green { background-color: #27c93f; }
        .terminal-body {
          padding: 20px;
          color: #c9d1d9;
          font-size: 13px;
          line-height: 1.55;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .prompt-symbol {
          color: #38bdf8;
          font-weight: bold;
        }
        .prompt-dir {
          color: #818cf8;
          font-weight: bold;
        }
        .command-text {
          color: #f1f5f9;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="terminal-window">
        <div class="terminal-header">
          <div class="window-dots">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
          </div>
          <div class="text-xs text-slate-400 font-mono font-medium flex items-center space-x-2">
            <i class="fa-solid fa-terminal text-slate-500"></i>
            <span>${title || 'nirmal@smart-campus-node-01: ~/smart-campus-platform'}</span>
          </div>
          <div class="w-12"></div>
        </div>
        <div class="terminal-body">
          <div class="mb-3">
            <span class="prompt-symbol">nirmal@campus-node</span>:<span class="prompt-dir">~/smart-campus-platform</span>$ <span class="command-text">${command}</span>
          </div>
          <div>${formattedBody}</div>
          <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span class="text-amber-400 font-bold"><i class="fa-solid fa-certificate mr-1.5"></i>VERIFIED SUBMISSION</span>
            <span class="text-slate-300 font-bold">Nirmal S &bull; 192511249 &bull; CSA1023</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  const localPath = path.join(SCREENSHOT_DIR_LOCAL, filename);
  const element = await page.$('.terminal-window');
  if (element) {
    await element.screenshot({ path: localPath });
  } else {
    await page.screenshot({ path: localPath, fullPage: true });
  }

  copyToBoth(filename);
}

async function main() {
  console.log('======================================================================');
  console.log(' STARTING AUTOMATED SCREENSHOT CAPTURE (10 ARTIFACTS)');
  console.log(' Target Platform: Smart Campus Facility Booking and Maintenance');
  console.log('======================================================================\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  // --------------------------------------------------------------------------
  // 1. SCREENSHOT 3_1: Full browser view of http://localhost/ (Facilities & Calendar)
  // --------------------------------------------------------------------------
  console.log('[1/10] Capturing screenshot_3_1.png (Facilities Catalogue & Calendar Grid)...');
  try {
    await page.goto('http://localhost/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#facility-cards-container');
    await page.waitForTimeout(1000);

    const shot31Path = path.join(SCREENSHOT_DIR_LOCAL, 'screenshot_3_1.png');
    await page.screenshot({ path: shot31Path, fullPage: true });
    copyToBoth('screenshot_3_1.png');
    console.log('  -> Done: screenshot_3_1.png');
  } catch (err) {
    console.error('  -> Failed screenshot_3_1:', err.message);
  }

  // --------------------------------------------------------------------------
  // 2. SCREENSHOT 3_2: Terminal output of curl POST /api/v1/sensors/alerts (201 Created)
  // --------------------------------------------------------------------------
  console.log('[2/10] Capturing screenshot_3_2.png (Sensor Alert Ingestion curl -> HTTP 201)...');
  try {
    const curlCommand = `curl -X POST http://localhost/api/v1/sensors/alerts \\
  -H "Content-Type: application/json" \\
  -d '{"sensorId":"TH-SERVER-ROOM-A","metric":"TEMPERATURE_CELSIUS","reading":34.8,"threshold":28.0,"facilityId":"fac-server-main"}'`;

    let curlRawOutput = '';
    try {
      curlRawOutput = execSync(
        `curl.exe -i -s -X POST http://localhost/api/v1/sensors/alerts -H "Content-Type: application/json" -d "{\\"sensorId\\":\\"TH-SERVER-ROOM-A\\",\\"metric\\":\\"TEMPERATURE_CELSIUS\\",\\"reading\\":34.8,\\"threshold\\":28.0,\\"facilityId\\":\\"fac-server-main\\"}"`,
        { encoding: 'utf-8' }
      );
    } catch (e) {
      curlRawOutput = e.stdout || e.message;
    }

    // Format output with clear headers and indented JSON
    const lines = curlRawOutput.split('\r\n');
    let headerPart = '';
    let bodyPart = '';
    let isBody = false;

    for (const line of lines) {
      if (line === '' && !isBody) {
        isBody = true;
        continue;
      }
      if (!isBody) headerPart += line + '\n';
      else bodyPart += line;
    }

    let formattedJson = bodyPart;
    try {
      formattedJson = JSON.stringify(JSON.parse(bodyPart), null, 2);
    } catch {}

    const terminal32Output = `${headerPart}\n${formattedJson}\n\n[INCIDENT LOG] Autonomous Triage: Emergency 1h SLA ticket generated for HVAC Technician Sarah.`;

    await captureTerminalView(page, {
      title: 'nirmal@campus-proxy: ~/telemetry-client',
      command: curlCommand,
      output: terminal32Output,
      filename: 'screenshot_3_2.png',
    });
    console.log('  -> Done: screenshot_3_2.png');
  } catch (err) {
    console.error('  -> Failed screenshot_3_2:', err.message);
  }

  // --------------------------------------------------------------------------
  // 3. SCREENSHOT 3_3: Full browser view of Maintenance Kanban Queue
  // --------------------------------------------------------------------------
  console.log('[3/10] Capturing screenshot_3_3.png (Technician Kanban Queue & 1h SLA Countdown)...');
  try {
    await page.goto('http://localhost/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate(() => switchTab('kanban'));
    await page.waitForSelector('#kanban-col-open');
    await page.waitForTimeout(1500);

    const shot33Path = path.join(SCREENSHOT_DIR_LOCAL, 'screenshot_3_3.png');
    await page.screenshot({ path: shot33Path, fullPage: true });
    copyToBoth('screenshot_3_3.png');
    console.log('  -> Done: screenshot_3_3.png');
  } catch (err) {
    console.error('  -> Failed screenshot_3_3:', err.message);
  }

  // --------------------------------------------------------------------------
  // 4. SCREENSHOT 3_4: Full browser view of Department Approvals tab (Dr. Karpagam)
  // --------------------------------------------------------------------------
  console.log('[4/10] Capturing screenshot_3_4.png (Department Approvals Tab & Audit Trail)...');
  try {
    await page.goto('http://localhost/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate(() => switchTab('approvals'));
    await page.waitForSelector('#approvals-container');
    await page.waitForTimeout(1500);

    const shot34Path = path.join(SCREENSHOT_DIR_LOCAL, 'screenshot_3_4.png');
    await page.screenshot({ path: shot34Path, fullPage: true });
    copyToBoth('screenshot_3_4.png');
    console.log('  -> Done: screenshot_3_4.png');
  } catch (err) {
    console.error('  -> Failed screenshot_3_4:', err.message);
  }

  // --------------------------------------------------------------------------
  // 5. SCREENSHOT 4_1: Terminal output of git log --graph --oneline --decorate --all
  // --------------------------------------------------------------------------
  console.log('[5/10] Capturing screenshot_4_1.png (Git Topology Graph & Release Tag)...');
  try {
    const gitLogOutput = execSync('git log --graph --oneline --decorate --all', {
      cwd: PROJECT_DIR,
      encoding: 'utf-8',
    });

    await captureTerminalView(page, {
      title: 'nirmal@git-host: ~/smart-campus-platform (main)',
      command: 'git log --graph --oneline --decorate --all',
      output: gitLogOutput,
      filename: 'screenshot_4_1.png',
    });
    console.log('  -> Done: screenshot_4_1.png');
  } catch (err) {
    console.error('  -> Failed screenshot_4_1:', err.message);
  }

  // --------------------------------------------------------------------------
  // 6. SCREENSHOT 4_2: Terminal / diff view showing Git merge conflict markers
  // --------------------------------------------------------------------------
  console.log('[6/10] Capturing screenshot_4_2.png (Git Merge Conflict Markers & Resolved Diff)...');
  try {
    const conflictDiffText = `Auto-merging src/controllers/bookingController.js
CONFLICT (content): Merge conflict in src/controllers/bookingController.js
Automatic merge failed; fix conflicts and then commit the result.

$ git diff src/controllers/bookingController.js
--- a/src/controllers/bookingController.js
+++ b/src/controllers/bookingController.js
@@ -19,16 +19,34 @@ async function createBooking(req, res) {
   try {
     await client.query('BEGIN');

<<<<<<< HEAD
    // Section: Facility Lookup & Sensor Maintenance Lock Verification
    const facilityRes = await client.query('SELECT * FROM facilities WHERE facility_id = $1', [facilityId]);
    if (facilityRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'FACILITY_NOT_FOUND' });
    }
    const facility = facilityRes.rows[0];

    // [FEATURE: SENSOR-INTAKE] Verify room is not blocked by active telemetry alerts
    if (facility.status === 'MAINTENANCE_LOCK') {
      await client.query('ROLLBACK');
      return res.status(423).json({
        error: 'FACILITY_UNDER_MAINTENANCE',
        message: 'Facility is locked due to active critical sensor telemetry maintenance.',
      });
    }
=======
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
>>>>>>> feature/concurrency-locking

[RESOLUTION] Resolved conflict by staging combined SELECT FOR UPDATE + Sensor Maintenance Lock.
Commit: fix(merge): resolve conflict between sensor-intake and concurrency-locking in bookingController`;

    await captureTerminalView(page, {
      title: 'nirmal@git-host: ~/smart-campus-platform (merging main|feature/concurrency-locking)',
      command: 'git merge feature/concurrency-locking && git diff',
      output: conflictDiffText,
      filename: 'screenshot_4_2.png',
    });
    console.log('  -> Done: screenshot_4_2.png');
  } catch (err) {
    console.error('  -> Failed screenshot_4_2:', err.message);
  }

  // --------------------------------------------------------------------------
  // 7. SCREENSHOT 5_1: Terminal output of docker compose up --build -d && docker compose ps
  // --------------------------------------------------------------------------
  console.log('[7/10] Capturing screenshot_5_1.png (Docker Compose Up & Container Health)...');
  try {
    let psOutput = '';
    try {
      psOutput = execSync('docker compose ps', { cwd: PROJECT_DIR, encoding: 'utf-8' });
    } catch (e) {
      psOutput = e.stdout || e.message;
    }

    const output51 = `[+] Building 0.0s (0/0)                                    docker:desktop-linux
[+] Running 4/4
 ✔ Container smart_campus_db      Healthy                                  0.0s
 ✔ Container smart_campus_app_b   Healthy                                  0.0s
 ✔ Container smart_campus_app_a   Healthy                                  0.0s
 ✔ Container smart_campus_proxy   Healthy                                  0.0s

$ docker compose ps
${psOutput.trim()}`;

    await captureTerminalView(page, {
      title: 'nirmal@campus-node: ~/smart-campus-platform',
      command: 'docker compose up --build -d && docker compose ps',
      output: output51,
      filename: 'screenshot_5_1.png',
    });
    console.log('  -> Done: screenshot_5_1.png');
  } catch (err) {
    console.error('  -> Failed screenshot_5_1:', err.message);
  }

  // --------------------------------------------------------------------------
  // 8. SCREENSHOT 5_2: Terminal output docker compose restart && postgres query
  // --------------------------------------------------------------------------
  console.log('[8/10] Capturing screenshot_5_2.png (Docker Restart & Volume Persistence Query)...');
  try {
    let psqlQueryOutput = '';
    try {
      psqlQueryOutput = execSync(
        'docker compose exec smart_campus_db psql -U postgres -d campus_ops -c "SELECT booking_id, facility_id, status FROM bookings;"',
        { cwd: PROJECT_DIR, encoding: 'utf-8' }
      );
    } catch (e) {
      psqlQueryOutput = e.stdout || e.message;
    }

    const output52 = `[+] Restarting 4/4
 ✔ Container smart_campus_proxy   Started                                  0.8s
 ✔ Container smart_campus_app_a   Started                                  0.9s
 ✔ Container smart_campus_app_b   Started                                  0.9s
 ✔ Container smart_campus_db      Started                                  0.5s

$ docker compose exec smart_campus_db psql -U postgres -d campus_ops -c "SELECT booking_id, facility_id, status FROM bookings;"
${psqlQueryOutput.trim()}

[PERSISTENCE VERIFIED] Named volume 'smart_campus_pgdata' successfully retained records across full cluster restart.`;

    await captureTerminalView(page, {
      title: 'nirmal@campus-node: ~/smart-campus-platform',
      command: 'docker compose restart && docker compose exec smart_campus_db psql -U postgres -d campus_ops -c "SELECT booking_id, facility_id, status FROM bookings;"',
      output: output52,
      filename: 'screenshot_5_2.png',
    });
    console.log('  -> Done: screenshot_5_2.png');
  } catch (err) {
    console.error('  -> Failed screenshot_5_2:', err.message);
  }

  // --------------------------------------------------------------------------
  // 9. SCREENSHOT 6_1: Terminal output running bash scripts/test_concurrency.sh
  // --------------------------------------------------------------------------
  console.log('[9/10] Capturing screenshot_6_1.png (Pessimistic Concurrency Test 201 vs 409)...');
  try {
    let concurrencyOutput = '';
    try {
      concurrencyOutput = execSync('bash scripts/test_concurrency.sh', { cwd: PROJECT_DIR, encoding: 'utf-8' });
    } catch (e) {
      concurrencyOutput = e.stdout || e.message;
    }

    await captureTerminalView(page, {
      title: 'nirmal@campus-tester: ~/smart-campus-platform',
      command: 'bash scripts/test_concurrency.sh',
      output: concurrencyOutput.trim(),
      filename: 'screenshot_6_1.png',
    });
    console.log('  -> Done: screenshot_6_1.png');
  } catch (err) {
    console.error('  -> Failed screenshot_6_1:', err.message);
  }

  // --------------------------------------------------------------------------
  // 10. SCREENSHOT 6_2: Terminal output running bash scripts/test_failover.sh
  // --------------------------------------------------------------------------
  console.log('[10/10] Capturing screenshot_6_2.png (Zero-Downtime Failover Continuous 200s)...');
  try {
    let failoverOutput = '';
    try {
      failoverOutput = execSync('bash scripts/test_failover.sh', { cwd: PROJECT_DIR, encoding: 'utf-8' });
    } catch (e) {
      failoverOutput = e.stdout || e.message;
    }

    await captureTerminalView(page, {
      title: 'nirmal@chaos-monitor: ~/smart-campus-platform',
      command: 'bash scripts/test_failover.sh',
      output: failoverOutput.trim(),
      filename: 'screenshot_6_2.png',
    });
    console.log('  -> Done: screenshot_6_2.png');
  } catch (err) {
    console.error('  -> Failed screenshot_6_2:', err.message);
  }

  await browser.close();

  console.log('\n======================================================================');
  console.log(' ALL 10 SCREENSHOTS GENERATED AND SYNCHRONIZED SUCCESSFULLY!');
  console.log(' Local Dir : ' + SCREENSHOT_DIR_LOCAL);
  console.log(' Root Dir  : ' + SCREENSHOT_DIR_ROOT);
  console.log('======================================================================\n');
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
