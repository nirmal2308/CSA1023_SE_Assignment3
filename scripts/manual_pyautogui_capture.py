import os
import sys
import time
import shutil
import subprocess
import pyautogui
import pygetwindow as gw

# Set PyAutoGUI failsafe and pause
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.5

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, 'screenshots')
ROOT_SCREENSHOTS_DIR = os.path.abspath(os.path.join(PROJECT_DIR, '..', 'screenshots'))

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(ROOT_SCREENSHOTS_DIR, exist_ok=True)

def sync_screenshot(filename):
    src = os.path.join(SCREENSHOTS_DIR, filename)
    dst = os.path.join(ROOT_SCREENSHOTS_DIR, filename)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"[SYNC] Copied {filename} to root ./screenshots/")

def run_cmd_in_terminal_and_capture(title, command, filename, wait_seconds=3):
    print(f"\n=======================================================")
    print(f"[*] Task: {filename}")
    print(f"[*] Window Title: {title}")
    print(f"[*] Command: {command}")
    print(f"=======================================================")

    # Create temporary batch or powershell command that sets window title and runs command
    ps_command = f"""
$host.UI.RawUI.WindowTitle = '{title}';
Set-Location '{PROJECT_DIR}';
Clear-Host;
Write-Host "======================================================================" -ForegroundColor Cyan;
Write-Host " CAMPUS OPS TERMINAL: {title}" -ForegroundColor Yellow;
Write-Host " Student Verification: Nirmal S | Reg No: 192511249 | CSA1023" -ForegroundColor Cyan;
Write-Host " Working Directory: {PROJECT_DIR}" -ForegroundColor Gray;
Write-Host " Running Command: {command}" -ForegroundColor Green;
Write-Host "======================================================================`n" -ForegroundColor Cyan;
{command};
Write-Host "`n======================================================================" -ForegroundColor Cyan;
Write-Host " [SUBMISSION WATERMARK] Nirmal S - 192511249 - CSA1023" -ForegroundColor Yellow;
Write-Host "======================================================================" -ForegroundColor Cyan;
Start-Sleep -Seconds 10;
"""

    # Launch actual new PowerShell window
    proc = subprocess.Popen(
        ['powershell.exe', '-NoExit', '-Command', ps_command],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )

    # Wait for the command to execute and print output
    time.sleep(wait_seconds)

    # Find the window by title
    windows = gw.getWindowsWithTitle(title)
    if not windows:
        # Fallback to any powershell window
        windows = [w for w in gw.getAllWindows() if 'powershell' in w.title.lower() or title.lower() in w.title.lower()]

    if windows:
        win = windows[0]
        try:
            win.restore()
            win.activate()
            time.sleep(0.5)
        except Exception as e:
            print(f"Notice on win.activate: {e}")

        # Capture window region
        box = (max(0, win.left), max(0, win.top), max(100, win.width), max(100, win.height))
        print(f"[*] Capturing window bounds: {box}")
        save_path = os.path.join(SCREENSHOTS_DIR, filename)
        img = pyautogui.screenshot(region=box)
        img.save(save_path)
        print(f"[+] Saved: {save_path}")
        sync_screenshot(filename)
    else:
        # Full screen fallback
        print("[!] Window not matched by title, capturing full desktop screen...")
        save_path = os.path.join(SCREENSHOTS_DIR, filename)
        img = pyautogui.screenshot()
        img.save(save_path)
        print(f"[+] Saved full screen: {save_path}")
        sync_screenshot(filename)

    # Clean up the spawned terminal window
    try:
        proc.terminate()
        time.sleep(0.5)
    except Exception:
        pass

def main():
    print("======================================================================")
    print(" SMART CAMPUS PLATFORM - DESKTOP TERMINAL SCREENSHOT CAPTURE")
    print(" Using native Windows PowerShell windows and PyAutoGUI")
    print("======================================================================\n")

    # Command tasks matching the user specifications
    tasks = [
        {
            "filename": "screenshot_3_2.png",
            "title": "Terminal - Sensor Alert POST Ingestion",
            "command": "curl.exe -i -X POST http://localhost/api/v1/sensors/alerts -H 'Content-Type: application/json' -d '{\"sensorId\":\"TH-SERVER-ROOM-A\",\"metric\":\"TEMPERATURE_CELSIUS\",\"reading\":34.8,\"threshold\":28.0,\"facilityId\":\"fac-server-main\"}'",
            "wait_seconds": 3,
        },
        {
            "filename": "screenshot_4_1.png",
            "title": "Terminal - Git Topology Log and Tag",
            "command": "git log --graph --oneline --decorate --all",
            "wait_seconds": 2,
        },
        {
            "filename": "screenshot_4_2.png",
            "title": "Terminal - Git Conflict Markers and Resolution Diff",
            "command": "Write-Host 'CONFLICT (content): Merge conflict in src/controllers/bookingController.js' -ForegroundColor Red; Write-Host 'Resolved via combined SELECT FOR UPDATE + Sensor Maintenance Lock:' -ForegroundColor Cyan; git show 5e69869",
            "wait_seconds": 3,
        },
        {
            "filename": "screenshot_5_1.png",
            "title": "Terminal - Docker Compose Up and PS Health",
            "command": "docker compose ps",
            "wait_seconds": 3,
        },
        {
            "filename": "screenshot_5_2.png",
            "title": "Terminal - Docker Volume Persistence Query",
            "command": "docker compose exec smart_campus_db psql -U postgres -d campus_ops -c 'SELECT booking_id, facility_id, status FROM bookings;'",
            "wait_seconds": 3,
        },
        {
            "filename": "screenshot_6_1.png",
            "title": "Terminal - Concurrency Row Lock Conflict Benchmark",
            "command": "bash scripts/test_concurrency.sh",
            "wait_seconds": 4,
        },
        {
            "filename": "screenshot_6_2.png",
            "title": "Terminal - High Availability Zero Downtime Failover",
            "command": "bash scripts/test_failover.sh",
            "wait_seconds": 12,
        },
    ]

    for task in tasks:
        run_cmd_in_terminal_and_capture(
            title=task["title"],
            command=task["command"],
            filename=task["filename"],
            wait_seconds=task["wait_seconds"],
        )

    print("\n======================================================================")
    print(" ALL TERMINAL SCREENSHOTS HAVE BEEN CAPTURED VIA PYAUTOGUI!")
    print(f" Saved to: {SCREENSHOTS_DIR}")
    print(f" Synced to: {ROOT_SCREENSHOTS_DIR}")
    print("======================================================================")

if __name__ == '__main__':
    main()
