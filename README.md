# Classmark RFID Attendance

Student registration with scan-to-assign RFID enrollment, student register, card management, and daily attendance using React, FastAPI, Supabase, and an ESP32 reader.

## Requirements

- Python 3.10 or newer
- Node.js 20.19+ or 22.12+
- A Supabase project
- ESP32 DevKit and an MFRC522 (RC522) reader for hardware check-in

## Supabase setup

1. Open the Supabase project SQL Editor.
2. Run [`database/schema.sql`](database/schema.sql). If the original tables are already installed, rerun the updated file to add the enrollment and attendance scan-event tables/columns; existing tables and records are preserved.
3. In Supabase project settings, copy the project URL and a **server-only secret/service-role key**. Do not use the publishable/anon key for the backend, and never put the secret in the frontend or firmware.
4. Copy `backend/.env.example` to `backend/.env` and fill in the project URL and server-only key. Keep `.env` private; it is ignored by Git.

The schema enables row-level security without public policies. The FastAPI server accesses the tables using its server-only key. Do not expose the FastAPI service to the public internet without adding administrator authentication, HTTPS, and request protections.

## Run the application

In a terminal, from the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

For hardware runs, `cd backend` and run `\.\run_lan.ps1`; it applies the LAN binding and uses the backend virtual environment.

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Vite proxies `/api` to the local FastAPI server. FastAPI documentation is available at `http://127.0.0.1:8000/docs`.

Attendance dates and dashboard totals use the `Africa/Kigali` timezone. The first RFID scan from an active student/card pair is recorded for the day; later scans that day return `already_recorded`.

Attendance scans, including rejected attempts and repeat check-ins, appear in the global notification bell and toast alerts on every app page. These notifications require the `attendance_scan_events` table from the current schema.

## ESP32 reader

Open [`esp32/student_rfid_attendance/student_rfid_attendance.ino`](esp32/student_rfid_attendance/student_rfid_attendance.ino), set the Wi-Fi credentials and the computer's LAN address in `API_URL`, and upload it to the ESP32. Follow [`docs/HARDWARE_SETUP.md`](docs/HARDWARE_SETUP.md) for the pin map, network setup, and enrollment/test sequence.

Open **Students → Add student** to save a student and start RFID enrollment. With the ESP32 online, tap the card when the registration page reports that the reader is ready. The assigned UID and student identity are then shown on the page and stored in Supabase. The RFID cards page remains available for managing cards later.

During enrollment the ESP32 polls `GET /rfid/enrollment-requests/pending` and submits the scanned UID to `POST /rfid/enrollment-requests/{request_id}/scan`. In attendance mode it sends `POST /attendance/scan` with `{ "uid": "...", "device_id": "..." }`.