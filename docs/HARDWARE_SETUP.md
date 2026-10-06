# ESP32 RFID Reader

## Parts

- ESP32 DevKit (classic ESP32-WROOM board)
- MFRC522 / RC522 13.56 MHz reader
- Active buzzer module
- Three LEDs (green, yellow, red) and one 220-330 ohm series resistor per LED
- Breadboard and jumper wires
- MIFARE-compatible 13.56 MHz cards or tags

The firmware is [`esp32/student_rfid_attendance/student_rfid_attendance.ino`](../esp32/student_rfid_attendance/student_rfid_attendance.ino). Its pin constants are the source of truth for this wiring table.

## Wiring

| RC522 / part | ESP32 DevKit pin |
| --- | --- |
| SDA / SS | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 22 |
| 3.3V | 3V3 |
| GND | GND |
| Green LED anode | GPIO 27 through a 220-330 ohm resistor |
| Yellow LED anode | GPIO 25 through a 220-330 ohm resistor |
| Red LED anode | GPIO 32 through a 220-330 ohm resistor |
| LED cathodes | GND |
| Active buzzer + | GPIO 26 |
| Active buzzer - | GND |

**Power the RC522 from 3.3V only. Do not connect its VCC to 5V.** Connect all grounds together. The RC522 header marked `SDA` is the SPI chip-select pin, not an I2C data pin. Do not use the ESP32's input-only GPIOs for the LED or buzzer.

```text
ESP32 3V3  ---------------- RC522 3.3V
ESP32 GND  ---------------- RC522 GND ---- all LED cathodes ---- buzzer -
ESP32 GPIO 5 -------------- RC522 SDA/SS
ESP32 GPIO 18 ------------- RC522 SCK
ESP32 GPIO 23 ------------- RC522 MOSI
ESP32 GPIO 19 ------------- RC522 MISO
ESP32 GPIO 22 ------------- RC522 RST
ESP32 GPIO 27 --- 220R ---- Green LED anode
ESP32 GPIO 25 --- 220R ---- Yellow LED anode
ESP32 GPIO 32 --- 220R ---- Red LED anode
ESP32 GPIO 26 ------------- active buzzer +
```

Connect each LED cathode (short leg/flat side) to GND; do not share a resistor between LEDs. The three LED outputs and buzzer share the ESP32 ground with the RC522. The firmware uses an active buzzer, switched directly on/off for each beep. If your buzzer module draws more current than an ESP32 GPIO can safely supply, drive it through a transistor instead of powering it from the pin.

## Firmware setup

1. Install Arduino IDE and the Espressif ESP32 board package.
2. Select an ESP32 Dev Module board and the detected serial port.
3. In Library Manager install **MFRC522** by GithubCommunity and **ArduinoJson 6**.
4. In the `.ino` file set `WIFI_SSID` and `WIFI_PASSWORD`.
5. Set `API_URL` to the computer's LAN IPv4 address, for example `http://192.168.1.42:8000/attendance/scan`. Do not use `localhost` or `127.0.0.1`; those addresses point back to the ESP32 itself.
6. Upload, open Serial Monitor at **115200 baud**, and confirm the reader connects to Wi-Fi.

Start FastAPI on the LAN interface from the `backend` folder. This script binds the server to `0.0.0.0` so the ESP32 can connect:

```powershell
.\run_lan.ps1
```

Allow inbound TCP port 8000 for the private network in Windows Firewall if prompted. Keep the computer and ESP32 on a trusted network. The HTTP connection is unencrypted and the API currently has no user authentication; do not port-forward it or expose it to the public internet.

## Enrollment and test

1. Run [`database/schema.sql`](../database/schema.sql) in Supabase. If you ran it before adding this workflow, run the updated file again; it creates the enrollment request table without replacing existing tables or records.
2. Set the backend `.env`, start FastAPI, and power the ESP32 reader. The ESP32 checks the enrollment queue every two seconds.
3. In the web app open **Students → Add student**. Save the student details; the student ID and name appear on the registration page immediately, and an enrollment request is queued automatically.
4. Wait until the registration page says **Reader ready**, then tap the student's card on the RC522 reader. The UID is sent to the pending enrollment request, assigned in Supabase, and displayed with the student's name and ID on that page.
5. Observe the workflow indicators:
   - **Yellow on:** the reader is waiting for a card during enrollment or sending a scan to the API.
   - **Green on + one short beep:** the card was assigned during registration, or attendance was recorded/already recorded during normal check-in.
   - **Red on + two short beeps:** the card cannot be assigned or the student/card is inactive or unregistered. During registration, the request stays open so another card can be scanned.
   - **Red on + one long beep:** Wi-Fi/API/server failure. The reader retries the same scan up to two more times; inspect Serial Monitor if the reader remains offline.
6. The enrollment request completes after a successful card assignment, and the reader returns to attendance mode. Verify the linked card on the student register and verify attendance scans in the Attendance log. New attendance outcomes, including rejected scans and repeat check-ins, also appear in the app-wide notification bell/toasts. Daily attendance uses `Africa/Kigali` and ignores duplicate check-ins.

During registration the ESP32 polls `GET /rfid/enrollment-requests/pending` and posts the UID to `POST /rfid/enrollment-requests/{request_id}/scan`. Outside registration it uses `POST /attendance/scan`. It sends no Supabase credential; only the backend holds the database key. Student/card details and status messages are shown on the web page and Serial Monitor; no display module is connected.