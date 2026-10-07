#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFi.h>

const char *WIFI_SSID = "MERITE EQ";
const char *WIFI_PASSWORD = "laurent2";
const char *API_URL = "https://student-rfid-backend.onrender.com/attendance/scan";
const char *DEVICE_ID = "esp32-classroom-01";

constexpr uint8_t RFID_SS_PIN = 5;
constexpr uint8_t RFID_RST_PIN = 22;
constexpr uint8_t GREEN_LED_PIN = 27;
constexpr uint8_t YELLOW_LED_PIN = 25;
constexpr uint8_t RED_LED_PIN = 32;
constexpr uint8_t BUZZER_PIN = 26;
constexpr uint32_t SAME_CARD_COOLDOWN_MS = 2500;
constexpr uint8_t MAX_SCAN_ATTEMPTS = 3;
constexpr uint32_t ENROLLMENT_POLL_INTERVAL_MS = 2000;

MFRC522 reader(RFID_SS_PIN, RFID_RST_PIN);
String lastUid;
uint32_t lastScanAt = 0;
uint32_t lastEnrollmentPollAt = 0;
String enrollmentRequestId;
String enrollmentStudentName;
String enrollmentStudentId;

enum class ScanResult {
  Completed,
  RetryableError
};

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

bool connectToWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  for (uint8_t attempt = 0; attempt < 30 && WiFi.status() != WL_CONNECTED; attempt++) {
    delay(350);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi connection failed");
    return false;
  }

  Serial.print("Wi-Fi connected; ESP32 address: ");
  Serial.println(WiFi.localIP());
  Serial.print("Wi-Fi gateway: ");
  Serial.println(WiFi.gatewayIP());
  return true;
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
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(4000);

  if (!http.begin(client, pendingUrl)) return;

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

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(6000);

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
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(6000);

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
  Serial.println("Tap a registered MIFARE card to record attendance");
  Serial.printf("API target: %s\n", API_URL);
  connectToWifi();
  lastEnrollmentPollAt = millis() - ENROLLMENT_POLL_INTERVAL_MS;
}

void loop() {
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