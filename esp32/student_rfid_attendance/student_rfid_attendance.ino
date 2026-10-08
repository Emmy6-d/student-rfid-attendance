#include <ArduinoJson.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <MFRC522.h>
#include <Preferences.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>

#include <time.h>

const char *API_URL = "https://student-rfid-backend.onrender.com/attendance/scan";
const char *DEVICE_ID = "esp32-classroom-01";
constexpr char SETUP_WIFI_PASSWORD[] = "Admin1234";

const char BACKEND_ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
)EOF";

constexpr uint8_t RFID_SS_PIN = 5;
constexpr uint8_t RFID_RST_PIN = 22;
constexpr uint8_t GREEN_LED_PIN = 27;
constexpr uint8_t YELLOW_LED_PIN = 25;
constexpr uint8_t RED_LED_PIN = 32;
constexpr uint8_t BUZZER_PIN = 26;
constexpr uint32_t SAME_CARD_COOLDOWN_MS = 2500;
constexpr uint8_t MAX_SCAN_ATTEMPTS = 3;
constexpr uint32_t ENROLLMENT_POLL_INTERVAL_MS = 2000;
constexpr uint32_t HTTP_TIMEOUT_MS = 60000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 15000;
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 20000;
constexpr time_t VALID_CLOCK_EPOCH = 1700000000;
constexpr uint8_t MAX_WIFI_NETWORKS = 40;

MFRC522 reader(RFID_SS_PIN, RFID_RST_PIN);
WebServer setupServer(80);
DNSServer setupDnsServer;
Preferences wifiPreferences;
String lastUid;
uint32_t lastScanAt = 0;
uint32_t lastEnrollmentPollAt = 0;
uint32_t wifiAttemptStartedAt = 0;
uint32_t lastWifiAttemptAt = 0;
bool wifiConnectionInProgress = false;
bool wifiConnectedMessagePrinted = false;
bool timeSyncRequested = false;
bool clockIsSynchronized = false;
String configuredWifiSsid;
String configuredWifiPassword;
String setupNetworkName;
String enrollmentRequestId;
String enrollmentStudentName;
String enrollmentStudentId;

enum class ScanResult {
  Completed,
  RetryableError
};

const char SETUP_PAGE[] PROGMEM = R"HTML(
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#123c35">
  <title>RFID reader Wi-Fi setup</title>
  <style>
    :root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#17332e;background:#f3f7f5}
    body{margin:0;padding:24px 16px}
    main{max-width:520px;margin:32px auto;background:white;padding:24px;border-radius:18px;box-shadow:0 12px 36px #17332e16}
    h1{font-size:1.5rem;margin:0 0 8px}p{line-height:1.5;color:#526762}
    label{display:block;margin-top:18px;font-weight:650}
    select,input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #bacbc5;border-radius:10px;margin-top:7px}
    button{background:#126b55;border:0;color:#fff;font-weight:700;cursor:pointer;margin-top:14px}
    button.secondary{background:#e7f2ee;color:#145744}
    button:disabled{opacity:.55;cursor:wait}
    #message{min-height:1.5em;margin-top:14px;font-weight:600}
    .small{font-size:.9rem}.status{padding:12px;background:#edf6f2;border-radius:10px}
  </style>
</head>
<body>
  <main>
    <h1>RFID reader Wi-Fi setup</h1>
    <p>Choose a nearby 2.4 GHz Wi-Fi network. Its password is saved on this ESP32 only.</p>
    <p class="status" id="status">Checking reader connection…</p>
    <button class="secondary" id="scan" type="button">Scan for networks</button>
    <form id="wifi-form">
      <label for="ssid">Wi-Fi network</label>
      <select id="ssid" name="ssid" required>
        <option value="">Scan and choose a network</option>
      </select>
      <label for="password">Wi-Fi password</label>
      <input id="password" name="password" type="password" autocomplete="new-password" maxlength="64" placeholder="Leave blank for an open network">
      <button id="connect" type="submit">Save and connect</button>
    </form>
    <div id="message" role="status" aria-live="polite"></div>
    <p class="small">If a sign-in page normally appears when joining this network, it may not work with the ESP32. Use a 2.4 GHz network.</p>
  </main>
  <script>
    const list = document.querySelector('#ssid');
    const message = document.querySelector('#message');
    const scanButton = document.querySelector('#scan');
    const connectButton = document.querySelector('#connect');
    async function loadStatus() {
      try {
        const response = await fetch('/status', {cache: 'no-store'});
        const data = await response.json();
        document.querySelector('#status').textContent = data.connected
          ? `Connected to ${data.ssid} · device IP ${data.ip}`
          : 'Not connected to Wi-Fi yet.';
      } catch (_) {
        document.querySelector('#status').textContent = 'Reader status unavailable.';
      }
    }
    async function scanNetworks() {
      scanButton.disabled = true;
      message.textContent = 'Scanning nearby networks…';
      try {
        const response = await fetch('/networks', {cache: 'no-store'});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Network scan failed.');
        const strongest = new Map();
        for (const network of data.networks) {
          if (!network.ssid) continue;
          if (!strongest.has(network.ssid) || strongest.get(network.ssid).rssi < network.rssi) strongest.set(network.ssid, network);
        }
        list.replaceChildren(new Option('Choose a network', ''));
        [...strongest.values()].sort((a, b) => b.rssi - a.rssi).forEach(network => {
          const option = new Option(`${network.ssid} (${network.rssi} dBm${network.secure ? ', secured' : ', open'})`, network.ssid);
          list.add(option);
        });
        message.textContent = strongest.size ? `Found ${strongest.size} network(s).` : 'No named networks found. Try scanning again.';
      } catch (error) {
        message.textContent = error.message;
      } finally {
        scanButton.disabled = false;
      }
    }
    scanButton.addEventListener('click', scanNetworks);
    document.querySelector('#wifi-form').addEventListener('submit', async event => {
      event.preventDefault();
      connectButton.disabled = true;
      message.textContent = 'Trying to connect. This may take up to 20 seconds…';
      try {
        const form = new URLSearchParams(new FormData(event.currentTarget));
        const response = await fetch('/connect', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: form
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not connect.');
        message.textContent = `Connected to ${data.ssid}. You can close this page.`;
        document.querySelector('#password').value = '';
        await loadStatus();
      } catch (error) {
        message.textContent = error.message;
      } finally {
        connectButton.disabled = false;
      }
    });
    loadStatus();
    scanNetworks();
  </script>
</body>
</html>
)HTML";

void indicatorsOff() {
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(YELLOW_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
}

void showProcessing() {
  indicatorsOff();
  digitalWrite(YELLOW_LED_PIN, HIGH);
}

void signalSuccess(const char *message) {
  indicatorsOff();
  Serial.println(message);
  digitalWrite(GREEN_LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(120);
  digitalWrite(BUZZER_PIN, LOW);
  delay(500);
  digitalWrite(GREEN_LED_PIN, LOW);
}

void signalAccessDenied(const char *message) {
  indicatorsOff();
  Serial.println(message);
  digitalWrite(RED_LED_PIN, HIGH);

  for (uint8_t pulse = 0; pulse < 2; pulse++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(120);
  }

  digitalWrite(RED_LED_PIN, LOW);
}

void signalServerError() {
  indicatorsOff();
  digitalWrite(RED_LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(800);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
}

bool isAccessDenied(const char *status) {
  return strcmp(status, "invalid_uid") == 0 ||
         strcmp(status, "card_not_registered") == 0 ||
         strcmp(status, "card_inactive") == 0 ||
         strcmp(status, "student_not_found") == 0 ||
         strcmp(status, "student_inactive") == 0;
}

String readCardUid() {
  String uid;
  char byteText[3];

  for (byte index = 0; index < reader.uid.size; index++) {
    snprintf(byteText, sizeof(byteText), "%02X", static_cast<unsigned int>(reader.uid.uidByte[index]));
    uid += byteText;
  }

  return uid;
}

void sendJsonError(int statusCode, const char *message) {
  StaticJsonDocument<192> response;
  response["error"] = message;
  String body;
  serializeJson(response, body);
  setupServer.send(statusCode, "application/json", body);
}

void handleSetupRoot() {
  setupServer.sendHeader("Cache-Control", "no-store");
  setupServer.send_P(200, "text/html; charset=utf-8", SETUP_PAGE);
}

void handleSetupStatus() {
  StaticJsonDocument<256> response;
  const bool connected = WiFi.status() == WL_CONNECTED;
  response["connected"] = connected;
  response["ssid"] = connected ? WiFi.SSID() : "";
  response["ip"] = connected ? WiFi.localIP().toString() : "";
  String body;
  serializeJson(response, body);
  setupServer.sendHeader("Cache-Control", "no-store");
  setupServer.send(200, "application/json", body);
}

void handleNetworkScan() {
  const int networkCount = WiFi.scanNetworks(false, true);
  if (networkCount < 0) {
    WiFi.scanDelete();
    sendJsonError(500, "Wi-Fi scan failed. Please try again.");
    return;
  }

  DynamicJsonDocument response(8192);
  JsonArray networks = response.createNestedArray("networks");
  const int count = min(networkCount, static_cast<int>(MAX_WIFI_NETWORKS));
  for (int index = 0; index < count; index++) {
    JsonObject network = networks.createNestedObject();
    network["ssid"] = WiFi.SSID(index);
    network["rssi"] = WiFi.RSSI(index);
    network["secure"] = WiFi.encryptionType(index) != WIFI_AUTH_OPEN;
  }

  String body;
  serializeJson(response, body);
  WiFi.scanDelete();
  setupServer.sendHeader("Cache-Control", "no-store");
  setupServer.send(200, "application/json", body);
}

void handleWifiConnect() {
  const String requestedSsid = setupServer.arg("ssid");
  const String requestedPassword = setupServer.arg("password");
  if (requestedSsid.isEmpty() || requestedSsid.length() > 32 || requestedPassword.length() > 64) {
    sendJsonError(400, "Choose a valid Wi-Fi network and password.");
    return;
  }

  const String previousSsid = configuredWifiSsid;
  const String previousPassword = configuredWifiPassword;
  wifiConnectionInProgress = false;
  WiFi.disconnect(false, false);
  WiFi.begin(requestedSsid.c_str(), requestedPassword.c_str());

  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(100);
  }

  if (WiFi.status() != WL_CONNECTED) {
    configuredWifiSsid = previousSsid;
    configuredWifiPassword = previousPassword;
    if (!previousSsid.isEmpty()) {
      WiFi.begin(previousSsid.c_str(), previousPassword.c_str());
      wifiConnectionInProgress = true;
      wifiAttemptStartedAt = millis();
      lastWifiAttemptAt = wifiAttemptStartedAt;
    }
    sendJsonError(400, "Could not connect. Check the password and use a 2.4 GHz network.");
    return;
  }

  configuredWifiSsid = requestedSsid;
  configuredWifiPassword = requestedPassword;
  wifiPreferences.putString("ssid", configuredWifiSsid);
  wifiPreferences.putString("password", configuredWifiPassword);
  wifiConnectionInProgress = false;
  wifiConnectedMessagePrinted = false;

  StaticJsonDocument<192> response;
  response["connected"] = true;
  response["ssid"] = WiFi.SSID();
  response["ip"] = WiFi.localIP().toString();
  String body;
  serializeJson(response, body);
  setupServer.send(200, "application/json", body);

  Serial.printf("Connected to Wi-Fi: %s | device IP: %s\n",
                WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
}

void handleUnknownSetupPath() {
  setupServer.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/", true);
  setupServer.send(302, "text/plain", "");
}

void startSetupPortal() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);

  String macSuffix = WiFi.macAddress();
  macSuffix.replace(":", "");
  setupNetworkName = "Classmark-Setup-" + macSuffix.substring(max(0, static_cast<int>(macSuffix.length()) - 4));

  if (!WiFi.softAP(setupNetworkName.c_str(), SETUP_WIFI_PASSWORD)) {
    Serial.println("Could not start Wi-Fi setup hotspot");
  } else {
    Serial.printf("Wi-Fi setup hotspot: %s\n", setupNetworkName.c_str());
    Serial.printf("Setup hotspot password: %s\n", SETUP_WIFI_PASSWORD);
    Serial.printf("Setup page: http://%s/\n", WiFi.softAPIP().toString().c_str());
  }

  setupDnsServer.start(53, "*", WiFi.softAPIP());
  setupServer.on("/", HTTP_GET, handleSetupRoot);
  setupServer.on("/status", HTTP_GET, handleSetupStatus);
  setupServer.on("/networks", HTTP_GET, handleNetworkScan);
  setupServer.on("/connect", HTTP_POST, handleWifiConnect);
  setupServer.onNotFound(handleUnknownSetupPath);
  setupServer.begin();
}

void loadSavedWifi() {
  wifiPreferences.begin("wifi-config", false);
  configuredWifiSsid = wifiPreferences.getString("ssid", "");
  configuredWifiPassword = wifiPreferences.getString("password", "");
  if (configuredWifiSsid.isEmpty()) {
    Serial.println("No saved Wi-Fi credentials. Configure Wi-Fi through the setup hotspot.");
    return;
  }

  Serial.printf("Connecting to saved Wi-Fi: %s\n", configuredWifiSsid.c_str());
  WiFi.begin(configuredWifiSsid.c_str(), configuredWifiPassword.c_str());
  wifiConnectionInProgress = true;
  wifiAttemptStartedAt = millis();
  lastWifiAttemptAt = wifiAttemptStartedAt;
}

bool connectToWifi() {
  if (WiFi.status() == WL_CONNECTED) return clockIsSynchronized;
  if (configuredWifiSsid.isEmpty()) return false;

  const uint32_t now = millis();
  if (wifiConnectionInProgress &&
      now - wifiAttemptStartedAt >= WIFI_CONNECT_TIMEOUT_MS) {
    wifiConnectionInProgress = false;
    Serial.println("Wi-Fi connection timed out; setup hotspot remains available");
  }

  if (!wifiConnectionInProgress &&
      now - lastWifiAttemptAt >= WIFI_RETRY_INTERVAL_MS) {
    Serial.printf("Retrying Wi-Fi connection: %s\n", configuredWifiSsid.c_str());
    WiFi.begin(configuredWifiSsid.c_str(), configuredWifiPassword.c_str());
    wifiConnectionInProgress = true;
    wifiAttemptStartedAt = now;
    lastWifiAttemptAt = now;
  }
  return false;
}

void serviceWifiStatus() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnectionInProgress = false;
    if (!timeSyncRequested) {
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      timeSyncRequested = true;
      Serial.println("Synchronizing clock for secure HTTPS...");
    }
    if (!clockIsSynchronized && time(nullptr) >= VALID_CLOCK_EPOCH) {
      clockIsSynchronized = true;
      Serial.println("Clock synchronized; secure HTTPS is ready");
    }
    if (!wifiConnectedMessagePrinted) {
      wifiConnectedMessagePrinted = true;
      Serial.printf("Wi-Fi connected; ESP32 address: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("Wi-Fi gateway: %s\n", WiFi.gatewayIP().toString().c_str());
    }
  } else {
    wifiConnectedMessagePrinted = false;
    timeSyncRequested = false;
  }
}

String apiBaseUrl() {
  String baseUrl = API_URL;
  const int scanPathIndex = baseUrl.indexOf("/attendance/scan");
  if (scanPathIndex >= 0) baseUrl.remove(scanPathIndex);
  return baseUrl;
}

void pollEnrollmentRequest() {
  if (!connectToWifi()) return;

  const String pendingUrl = apiBaseUrl() + "/rfid/enrollment-requests/pending?device_id=" + DEVICE_ID;
  WiFiClientSecure client;
  client.setCACert(BACKEND_ROOT_CA);
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(client, pendingUrl)) {
    Serial.printf("Could not open enrollment queue URL: %s\n", pendingUrl.c_str());
    return;
  }

  const int httpCode = http.GET();
  const String responseBody = http.getString();
  http.end();

  if (httpCode != 200) {
    if (httpCode < 0) {
      Serial.printf("Enrollment queue poll failed: %d (%s) | target %s\n",
                    httpCode,
                    HTTPClient::errorToString(httpCode).c_str(),
                    pendingUrl.c_str());
    } else {
      Serial.printf("Enrollment queue returned HTTP %d: %s\n",
                    httpCode, responseBody.c_str());
    }
    return;
  }

  StaticJsonDocument<512> response;
  if (deserializeJson(response, responseBody)) {
    Serial.println("Could not read enrollment queue response");
    return;
  }

  if (!response["pending"].as<bool>()) {
    if (enrollmentRequestId.length()) {
      Serial.println("Card enrollment finished or cancelled; attendance mode ready");
    }
    enrollmentRequestId = "";
    enrollmentStudentName = "";
    enrollmentStudentId = "";
    digitalWrite(YELLOW_LED_PIN, LOW);
    return;
  }

  const String pendingRequestId = response["id"] | "";
  if (!pendingRequestId.length()) return;

  if (pendingRequestId != enrollmentRequestId) {
    enrollmentRequestId = pendingRequestId;
    enrollmentStudentName = response["student_name"] | "Student";
    enrollmentStudentId = response["student_id"] | "";
    Serial.printf("Enrollment ready for %s (%s). Tap their card.\n",
                  enrollmentStudentName.c_str(), enrollmentStudentId.c_str());
  }

  digitalWrite(YELLOW_LED_PIN, HIGH);
}

ScanResult postAttendanceAttempt(const String &uid) {
  showProcessing();

  if (!connectToWifi()) {
    return ScanResult::RetryableError;
  }

  WiFiClientSecure client;
  client.setCACert(BACKEND_ROOT_CA);
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(client, API_URL)) {
    Serial.println("Could not open the attendance API connection");
    return ScanResult::RetryableError;
  }

  StaticJsonDocument<160> request;
  request["uid"] = uid;
  request["device_id"] = DEVICE_ID;
  String requestBody;
  serializeJson(request, requestBody);

  http.addHeader("Content-Type", "application/json");
  const int httpCode = http.POST(requestBody);
  const String responseBody = http.getString();
  http.end();

  if (httpCode < 0) {
    Serial.printf("UID %s | transport error %d (%s)\n",
                  uid.c_str(), httpCode, HTTPClient::errorToString(httpCode).c_str());
  } else {
    Serial.printf("UID %s | HTTP %d\n", uid.c_str(), httpCode);
  }
  if (responseBody.length()) Serial.println(responseBody);

  if (httpCode < 200 || httpCode >= 300) {
    return ScanResult::RetryableError;
  }

  StaticJsonDocument<512> response;
  const DeserializationError parseError = deserializeJson(response, responseBody);
  if (parseError) {
    Serial.println("Could not read the attendance API response");
    return ScanResult::RetryableError;
  }

  const char *status = response["status"] | "unknown";
  if (strcmp(status, "attendance_recorded") == 0) {
    signalSuccess("Attendance recorded");
    return ScanResult::Completed;
  }

  if (strcmp(status, "already_recorded") == 0) {
    signalSuccess("Attendance already recorded today");
    return ScanResult::Completed;
  }

  if (isAccessDenied(status)) {
    signalAccessDenied("Access denied: card or student is not registered and active");
    return ScanResult::Completed;
  }

  Serial.printf("Attendance API returned status: %s\n", status);
  return ScanResult::RetryableError;
}

ScanResult postEnrollmentAttempt(const String &uid) {
  showProcessing();

  if (!connectToWifi()) return ScanResult::RetryableError;

  const String enrollmentUrl = apiBaseUrl() + "/rfid/enrollment-requests/" + enrollmentRequestId + "/scan";
  WiFiClientSecure client;
  client.setCACert(BACKEND_ROOT_CA);
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(client, enrollmentUrl)) {
    Serial.println("Could not open the enrollment API connection");
    return ScanResult::RetryableError;
  }

  StaticJsonDocument<160> request;
  request["uid"] = uid;
  request["device_id"] = DEVICE_ID;
  String requestBody;
  serializeJson(request, requestBody);

  http.addHeader("Content-Type", "application/json");
  const int httpCode = http.POST(requestBody);
  const String responseBody = http.getString();
  http.end();

  if (httpCode < 0) {
    Serial.printf("Enrollment UID %s | transport error %d (%s)\n",
                  uid.c_str(), httpCode, HTTPClient::errorToString(httpCode).c_str());
  } else {
    Serial.printf("Enrollment UID %s | HTTP %d\n", uid.c_str(), httpCode);
  }
  if (responseBody.length()) Serial.println(responseBody);

  StaticJsonDocument<512> response;
  const DeserializationError parseError = deserializeJson(response, responseBody);

  if (httpCode >= 200 && httpCode < 300) {
    if (parseError || !response["success"].as<bool>()) return ScanResult::RetryableError;

    const String assignedName = response["student_name"] | enrollmentStudentName;
    const String successMessage = "Card assigned to " + assignedName;
    signalSuccess(successMessage.c_str());
    enrollmentRequestId = "";
    enrollmentStudentName = "";
    enrollmentStudentId = "";
    return ScanResult::Completed;
  }

  if (httpCode == 409 && !parseError) {
    JsonVariantConst detail = response["detail"];
    const char *status = detail["status"] | "card_rejected";
    const char *message = detail["message"] | "Card cannot be assigned";

    if (strcmp(status, "request_not_pending") == 0 || strcmp(status, "request_not_found") == 0) {
      enrollmentRequestId = "";
      enrollmentStudentName = "";
      enrollmentStudentId = "";
      signalAccessDenied("Enrollment request ended; attendance mode will resume");
    } else {
      signalAccessDenied(message);
      digitalWrite(YELLOW_LED_PIN, HIGH);
    }
    return ScanResult::Completed;
  }

  return ScanResult::RetryableError;
}

void postAttendance(const String &uid) {
  for (uint8_t attempt = 1; attempt <= MAX_SCAN_ATTEMPTS; attempt++) {
    const ScanResult result = postAttendanceAttempt(uid);
    if (result == ScanResult::Completed) return;

    Serial.printf("Server/network error on attempt %u of %u\n", attempt, MAX_SCAN_ATTEMPTS);
    signalServerError();

    if (attempt == MAX_SCAN_ATTEMPTS) {
      Serial.println("Retry limit reached. Tap the card again to retry.");
      return;
    }

    Serial.println("Retrying the same card scan...");
    delay(700 * attempt);
  }
}

void postEnrollment(const String &uid) {
  for (uint8_t attempt = 1; attempt <= MAX_SCAN_ATTEMPTS; attempt++) {
    const ScanResult result = postEnrollmentAttempt(uid);
    if (result == ScanResult::Completed) return;

    Serial.printf("Enrollment network/server error on attempt %u of %u\n", attempt, MAX_SCAN_ATTEMPTS);
    signalServerError();

    if (attempt == MAX_SCAN_ATTEMPTS) {
      Serial.println("Retry limit reached. Keep the registration page open and tap again.");
      digitalWrite(YELLOW_LED_PIN, HIGH);
      return;
    }

    delay(700 * attempt);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(YELLOW_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  indicatorsOff();

  SPI.begin(18, 19, 23, RFID_SS_PIN);
  reader.PCD_Init();
  delay(50);

  Serial.println("Classmark RFID attendance reader ready");
  Serial.printf("API target: %s\n", API_URL);
  startSetupPortal();
  loadSavedWifi();
  lastEnrollmentPollAt = millis() - ENROLLMENT_POLL_INTERVAL_MS;
}

void loop() {
  setupDnsServer.processNextRequest();
  setupServer.handleClient();
  serviceWifiStatus();

  const uint32_t now = millis();
  if (now - lastEnrollmentPollAt >= ENROLLMENT_POLL_INTERVAL_MS) {
    lastEnrollmentPollAt = now;
    pollEnrollmentRequest();
  }

  if (!reader.PICC_IsNewCardPresent() || !reader.PICC_ReadCardSerial()) {
    delay(30);
    return;
  }

  const String uid = readCardUid();
  reader.PICC_HaltA();
  reader.PCD_StopCrypto1();

  const uint32_t scanNow = millis();
  if (uid == lastUid && scanNow - lastScanAt < SAME_CARD_COOLDOWN_MS) return;

  lastUid = uid;
  lastScanAt = scanNow;
  Serial.printf("Card detected: %s\n", uid.c_str());
  if (enrollmentRequestId.length()) {
    postEnrollment(uid);
  } else {
    postAttendance(uid);
  }
}