#include <Arduino.h>
#include <ArduinoOTA.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include "board_display.h"
#include "launcher.h"
#include "setup_page.h"
#include "bridge_address.h"
#include "receiver_control.h"

CydDisplay screen;
Preferences prefs;
WebServer setupServer(80);
DNSServer dns;
String wifiName, wifiPassword, serverBase, deviceName, setupPassword;
bool portal = false, otaStarted = false, updating = false, haveFrame = false;
bool portalConnecting = false;
bool connecting = false, connectFailed = false;
bool launcherVisible = true, setupDetails = false, setupRequested = false, usbPaused = false;
bool snakePlaying = false;
bool wasTouched = false;
bool retryRequested = false, receiverRetryTouch = false, receiverSettingsTouch = false;
cyd::RetrySchedule wifiRetry, streamRetry;
cyd::ControlLine controlLine;
uint32_t writeMHz = 24, clockExperimentAt = 0;
bool clockExperiment = false;
bool bridgeEditing = false, receiverAddressTouch = false;
int pressedAddressKey = -1;
String bridgeDigits;
cyd::BridgeAddress editingAddress;
uint32_t connectStarted = 0, lastFrameAt = 0, lastTapAt = 0, bootHeldAt = 0;
uint32_t frames = 0, errors = 0;
uint32_t wifiWindowStart = 0, wifiWindowDraws = 0, receiveMs = 0, drawMs = 0;
bool debugOverlay = false;
uint32_t measuredFpsTenths = 0;
uint32_t lastTouchPoll = 0, lastTouchEvent = 0;
uint16_t lastTouchX = 0, lastTouchY = 0;
uint8_t missingTouchSamples = 0;
#ifndef CYD_USB_BAUD
#define CYD_USB_BAUD 115200
#endif
constexpr uint32_t USB_BAUD = CYD_USB_BAUD;
uint32_t usbBaud = USB_BAUD, baudProgressAt = 0;
bool baudExperiment = false;
constexpr uint16_t SCREEN_WIDTH = 240, SCREEN_HEIGHT = 320;
constexpr size_t MAX_JPEG = 64 * 1024;
uint8_t* jpegBuffer = nullptr;
bool usbActive = false;
uint8_t usbStage = 0, usbMatch = 0, usbHelloMatch = 0, usbLengthBytes[4], usbLengthCount = 0;
uint32_t usbExpected = 0, usbReceived = 0, usbLastByte = 0, usbLastFrame = 0;
uint32_t lastGoodFrame = 0, lastSnakeStep = 0;
cyd::Snake snake;
cyd::UsbSession usbSession;
cyd::Swipe swipe;
cyd::TouchTarget touchOwner = cyd::TouchTarget::None;
bool touchOverUSB = false;
uint8_t setupStep = 0;
int setupPressedKey = -1;
int wizardPressedTab = -1;
bool stepDone[4] = {};
bool checklistTouch = false;
cyd::DrawRate displayRate;
cyd::WizardGesture wizardGesture;
String displayedStatus;
String frameStatus = "not checked", displayedDetail;
constexpr uint16_t BG = TFT_WHITE, MUTED = 0x632c, GREEN = 0x2346, INK = 0x1082, LINE = 0xdedb;

void drawWizardTabs(int active) {
  const char* labels[] = {"Run", "Wi-Fi", "Phone", "Restart"};
  for (int i = 0; i < 4; ++i) {
    const int x = i * 60;
    screen.fillRect(x, 0, 60, 44, i == active ? INK : BG);
    screen.drawRect(x, 0, 60, 44, LINE);
    screen.setTextColor(i == active ? BG : INK, i == active ? INK : BG);
    screen.setTextSize(1); screen.setCursor(x + 27, 7); screen.print(i + 1);
    if (stepDone[i]) {
      screen.drawLine(x + 43, 11, x + 47, 15, 0x05e0);
      screen.drawLine(x + 47, 15, x + 55, 5, 0x05e0);
    } else {
      screen.drawLine(x + 45, 7, x + 51, 13, MUTED);
      screen.drawLine(x + 51, 7, x + 45, 13, MUTED);
    }
    screen.setCursor(x + (60 - strlen(labels[i]) * 6) / 2, 25); screen.print(labels[i]);
  }
}

void drawWizardActions(const char* left, const char* right) {
  screen.drawRect(12, 270, 102, 44, LINE);
  screen.fillRect(126, 270, 102, 44, INK);
  screen.setTextSize(1); screen.setTextColor(INK, BG);
  screen.setCursor(12 + (102 - strlen(left) * 6) / 2, 288); screen.print(left);
  screen.setTextColor(BG, INK);
  screen.setCursor(126 + (102 - strlen(right) * 6) / 2, 288); screen.print(right);
  screen.setTextColor(INK, BG);
}

void drawWizardChevrons() {
  screen.drawLine(9, 151, 3, 159, MUTED); screen.drawLine(3, 159, 9, 167, MUTED);
  screen.drawLine(230, 151, 236, 159, MUTED); screen.drawLine(236, 159, 230, 167, MUTED);
}

void drawChecklist(uint8_t page) {
  const char* labels[] = {"Computer ready", "Phone joined", "Setup saved"};
  const char* links[] = {"localhost:3088/preview", "display Wi-Fi", "192.168.4.1"};
  if (page > 2) return;
  screen.fillRect(0, 224, 240, 42, BG);
  screen.drawRect(12, 228, 32, 32, INK);
  if (stepDone[page]) {
    screen.drawLine(18, 244, 25, 252, GREEN);
    screen.drawLine(25, 252, 38, 234, GREEN);
  }
  screen.setTextColor(INK, BG); screen.setTextSize(2);
  screen.setCursor(52, 228); screen.print(labels[page]);
  screen.setTextSize(1); screen.setTextColor(MUTED, BG);
  screen.setCursor(52, 251); screen.print(links[page]);
}

bool drawRemoteJpeg(const uint8_t* data, size_t length) {
  if (launcherVisible) screen.fillRect(0, 44, 240, 276, BG);
  return screen.drawJpg(data, length, 16, 44, 207, 276, 0, 0, 207.0f / 240, 276.0f / 320);
}

void drawConnectionMark(int x, int y, bool connected) {
  if (connected) {
    screen.drawLine(x, y + 4, x + 3, y + 7, GREEN);
    screen.drawLine(x + 3, y + 7, x + 10, y, GREEN);
  } else {
    screen.drawLine(x, y, x + 7, y + 7, MUTED);
    screen.drawLine(x + 7, y, x, y + 7, MUTED);
  }
}

void drawNetworkStatus(bool force = false) {
  if (bridgeEditing || setupDetails) return;
  const String status = cyd::connectionLabel(usbActive, portal, connecting, WiFi.status() == WL_CONNECTED,
    haveFrame && !launcherVisible && millis() - lastGoodFrame < 4000);
  const bool joined = WiFi.status() == WL_CONNECTED;
  if (!launcherVisible) {
    if (force) drawWizardTabs(0);
    const bool fresh = haveFrame && millis() - lastGoodFrame < 4000;
    screen.fillCircle(8, 52, 2, fresh && (joined || usbActive) ? 0x5ca8 : LINE);
    if (debugOverlay) {
      screen.fillRect(16, 44, 207, 32, BG);
      screen.setTextColor(INK, BG); screen.setTextSize(1); screen.setCursor(20, 48);
      screen.print(usbActive ? "USB data OK (slow)" : "Wi-Fi data OK");
      screen.setCursor(20, 61);
      if (displayRate.measured) screen.printf("%lu.%lu FPS measured", (unsigned long)(displayRate.tenths / 10), (unsigned long)(displayRate.tenths % 10));
      else screen.print("Measuring FPS...");
    }
    return;
  }
  const uint32_t retrySeconds = joined ? streamRetry.seconds(millis()) : wifiRetry.seconds(millis());
  const String detail = String(joined ? "joined" : connecting ? "joining" : "offline") + frameStatus + serverBase + String(retrySeconds);
  if (!force && status == displayedStatus && detail == displayedDetail) return;
  displayedStatus = status;
  displayedDetail = detail;
  screen.fillCircle(232, 52, 2, joined ? 0x5ca8 : LINE);
  screen.setTextSize(1);
  if (launcherVisible) {
    screen.fillRect(0, 44, 224, 14, BG);
    screen.setTextColor(joined ? GREEN : MUTED, BG);
    screen.setCursor(12, 47); screen.print(joined ? "Wi-Fi connected" : connecting ? "Connecting..." : "Wi-Fi not connected");
  }
  if (launcherVisible && !setupDetails) {
    screen.fillRect(0, 60, 240, 204, BG);
    screen.setTextColor(INK, BG); screen.setTextSize(2);
    screen.setCursor(12, 62); screen.print("Display ready");
    screen.setTextSize(1); screen.setTextColor(MUTED, BG);
    screen.setCursor(12, 90);
#ifdef CYD_BOARD_ESP32_024
    screen.print("ESP32-024 2.4in | Power OK");
#else
    screen.print("JC2432W328 2.8in | Power OK");
#endif
    screen.setCursor(12, 106); screen.print("WI-FI");
    screen.setTextColor(INK, BG); screen.setCursor(12, 117);
    screen.print(joined ? "Connected" : connecting ? "Connecting..." : wifiName.isEmpty() ? "Set up a network" : "Disconnected");
    drawConnectionMark(216, 118, joined);
    screen.drawFastHLine(12, 140, 216, LINE);
    screen.setTextColor(MUTED, BG); screen.setCursor(12, 155); screen.print("PICTURES FROM COMPUTER");
    screen.setTextColor(INK, BG); screen.setCursor(12, 172);
    const bool recentPicture = frames && millis() - lastGoodFrame < 4000;
    screen.print(recentPicture ? "Pictures received" : "No pictures yet");
    drawConnectionMark(216, 173, recentPicture);
    screen.setTextColor(MUTED, BG); screen.setCursor(12, 199); screen.print("USB ~1 FPS | Wi-Fi faster");
    screen.setCursor(12, 212);
    if (portal) screen.print("Phone setup open");
    else if (connecting) screen.print("Connecting...");
    else if (!wifiName.isEmpty()) screen.printf("Retry in %lu s", (unsigned long)retrySeconds);
    drawChecklist(0);
    drawWizardActions("Reset", "Done");
    drawWizardChevrons();
  }
}

void drawSnake() {
  screen.fillRect(11, 59, 218, 218, BG);
  screen.drawRect(11, 59, 218, 218, 0x2949);
  for (uint16_t i = 0; i < snake.length; ++i) {
    const int x = 12 + (snake.cells[i] % cyd::Snake::Side) * 12;
    const int y = 60 + (snake.cells[i] / cyd::Snake::Side) * 12;
    screen.fillRoundRect(x + 1, y + 1, 10, 10, 2, i ? 0x44ef : GREEN);
  }
  if (snake.alive) screen.fillCircle(18 + (snake.food % cyd::Snake::Side) * 12,
    66 + (snake.food / cyd::Snake::Side) * 12, 3, 0xfbce);
  screen.fillRect(0, 284, 240, 36, BG);
  screen.setTextSize(1); screen.setTextColor(MUTED, BG);
  screen.setCursor(12, 287); screen.printf("Score %u", unsigned(snake.length - 4));
  screen.setCursor(12, 304);
  screen.print(snake.alive ? (snakePlaying ? "Swipe to turn. Waiting for Pixsim." : "Swipe to start. Wi-Fi to connect.") : snake.won ? "You won! Tap to play again." : "Game over. Tap to play again.");
}

void showLauncher() {
  bridgeEditing = false; pressedAddressKey = -1;
  receiverAddressTouch = receiverRetryTouch = receiverSettingsTouch = false;
  if (touchOwner == cyd::TouchTarget::Remote) touchOwner = cyd::TouchTarget::Ignore;
  if (!launcherVisible) { snake.reset(esp_random()); snakePlaying = false; }
  launcherVisible = true; setupDetails = false; haveFrame = false;
  screen.fillScreen(BG);
  snakePlaying = false;
  drawWizardTabs(0);
  drawNetworkStatus(true);
}

void showSetupDetails() {
  if (usbSession.pause()) { Serial.println("USBSETUP REQUEST"); Serial.flush(); }
  usbPaused = true; usbActive = false;
  snakePlaying = false;
  launcherVisible = true; setupDetails = true; haveFrame = false;
  setupPressedKey = -1;
  screen.fillScreen(BG);
  drawWizardTabs(setupStep + 1);
  screen.setTextSize(2); screen.setTextColor(INK, BG);
  screen.setCursor(12, 58); screen.print(setupStep == 0 ? "Join display" : setupStep == 1 ? "Wi-Fi setup" : "Restart display?");
  if (setupStep == 2) {
    screen.setTextSize(1); screen.setTextColor(MUTED, BG);
    screen.setCursor(12, 105); screen.print("Saved settings stay.");
    drawWizardActions("Back", "Restart");
    drawWizardChevrons();
    return;
  }
  // Credentials stay device-local. Never log or capture the network QR.
  const String qr = setupStep == 0
    ? "WIFI:T:WPA;S:" + deviceName + ";P:" + setupPassword + ";;"
    : "http://192.168.4.1/";
  screen.qrcode(qr.c_str(), 56, 90, 128, 4, true);
  screen.setTextSize(1); screen.setTextColor(MUTED, BG);
  screen.setCursor(12, 80); screen.print(setupStep == 0 ? "Scan to join" : "Scan to open");
  drawChecklist(setupStep + 1);
  drawWizardActions("Back", setupStep == 0 ? "Done" : "Run");
  drawWizardChevrons();
}

void closePortal() {
  if (portal) { dns.stop(); setupServer.stop(); WiFi.softAPdisconnect(true); }
  portal = false; portalConnecting = false;
  WiFi.mode(WIFI_STA);
}

String escapeHTML(String value) {
  value.replace("&", "&amp;"); value.replace("<", "&lt;");
  value.replace(">", "&gt;"); value.replace("\"", "&quot;");
  value.replace("'", "&#39;"); return value;
}

void rememberConnection() {
  int slot = -1;
  for (int i = 0; i < 3; ++i) if (prefs.getString(("net" + String(i)).c_str(), "") == wifiName) slot = i;
  if (slot < 0) { slot = prefs.getUChar("next-net", 0) % 3; prefs.putUChar("next-net", (slot + 1) % 3); }
  prefs.putString(("net" + String(slot)).c_str(), wifiName);
  prefs.putString(("key" + String(slot)).c_str(), wifiPassword);
  prefs.putString(("url" + String(slot)).c_str(), serverBase);
}

void drawAddressEditor(const char* message = "Only change the last number") {
  screen.fillScreen(BG); screen.setTextColor(INK, BG); screen.setTextSize(2);
  screen.setCursor(12, 12); screen.print("Mac address");
  screen.setTextSize(1); screen.setTextColor(MUTED, BG); screen.setCursor(12, 45); screen.print(message);
  screen.setTextSize(2); screen.setTextColor(INK, BG); screen.setCursor(12, 65);
  screen.printf("%u.%u.%u.", editingAddress.ip[0], editingAddress.ip[1], editingAddress.ip[2]);
  screen.print(bridgeDigits.isEmpty() ? "_" : bridgeDigits);
  for (int row = 0; row < 4; ++row) for (int column = 0; column < 3; ++column) {
    const int x = 12 + column * 72, y = 100 + row * 40;
    screen.drawRect(x, y, 68, 36, LINE); screen.setTextSize(1); screen.setCursor(x + 22, y + 14);
    if (row < 3) screen.print(row * 3 + column + 1);
    else screen.print(column == 0 ? "Back" : column == 1 ? "0" : "Del");
  }
  screen.drawRect(12, 270, 216, 44, INK); screen.setCursor(75, 288); screen.print("Save + retry");
}

void openAddressEditor() {
  if (!cyd::parseBridgeAddress(serverBase.c_str(), editingAddress)) {
    frameStatus = "Edit full URL in Settings"; drawNetworkStatus(true); return;
  }
  bridgeEditing = true; bridgeDigits = ""; pressedAddressKey = -1;
  receiverRetryTouch = receiverSettingsTouch = receiverAddressTouch = false;
  touchOwner = cyd::TouchTarget::Ignore;
  drawAddressEditor();
}

void addressInput(int key) {
  if (key == 10) { bridgeEditing = false; showLauncher(); return; }
  if (key == 11) { if (bridgeDigits.length()) bridgeDigits.remove(bridgeDigits.length() - 1); }
  else if (key >= 0 && key <= 9) { if (bridgeDigits.length() < 3) bridgeDigits += char('0' + key); }
  else if (key == 12) {
    unsigned last;
    if (!cyd::parseLastOctet(bridgeDigits.c_str(), last)) { drawAddressEditor("Enter a number from 0 to 255"); return; }
    char url[48]; snprintf(url, sizeof(url), "http://%u.%u.%u.%u:%u", editingAddress.ip[0], editingAddress.ip[1], editingAddress.ip[2], last, editingAddress.port);
    if (!prefs.putString("server", url)) { drawAddressEditor("Could not save. Try again."); return; }
    serverBase = url;
    if (!wifiName.isEmpty()) rememberConnection();
    bridgeEditing = false; showLauncher(); retryRequested = true; return;
  }
  drawAddressEditor();
}

void showMessage(const String& title, const String& message) {
  screen.fillScreen(BG);
  screen.setTextColor(INK, BG);
  screen.setTextSize(2);
  screen.setCursor(8, 8);
  screen.println(title);
  screen.setTextSize(1);
  screen.setCursor(8, 42);
  screen.println(message);
}

void startPortal(uint8_t page) {
  bridgeEditing = false; pressedAddressKey = -1;
  setupStep = page;
  if (portal) { showSetupDetails(); return; }
  if (usbSession.pause()) { Serial.println("USBSETUP REQUEST"); Serial.flush(); }
  usbPaused = true;
  usbActive = false;
  portal = true; portalConnecting = false; haveFrame = false;
  connecting = false; connectFailed = false;
  // A saved network may reconnect later; only an explicit Save closes this portal.
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(deviceName.c_str(), setupPassword.c_str());
  dns.start(53, "*", WiFi.softAPIP());
  setupServer.begin();
  showSetupDetails();
  Serial.println("Setup portal active; access details are on the screen, not logged.");
}

void openWizardPage(uint8_t page) {
  if (page == 0) { showLauncher(); if (!wifiName.isEmpty()) retryRequested = true; }
  else if (page == 1 || page == 2) startPortal(page - 1);
  else { setupStep = 2; showSetupDetails(); }
}

void beginWiFi() {
  usbActive = false;
  portalConnecting = portal;
  connecting = true; connectFailed = false;
  WiFi.begin(wifiName.c_str(), wifiPassword.c_str());
  connectStarted = millis();
  streamRetry.reset();
  if (!portal) showLauncher();
  drawNetworkStatus(true);
}

bool isSetupClient() {
  // AP+STA uses two interfaces. Never accept configuration writes from the LAN.
  return portal && setupServer.client().localIP() == WiFi.softAPIP();
}

void setupRoutes() {
  const char* headers[] = {"Origin"};
  setupServer.collectHeaders(headers, 1);
  setupServer.on("/", HTTP_GET, []() {
    if (!isSetupClient()) { setupServer.send(403, "text/plain", "Use the device setup Wi-Fi"); return; }
    if (setupServer.hostHeader() != "192.168.4.1" && setupServer.hostHeader() != "192.168.4.1:80") {
      setupServer.sendHeader("Location", "http://192.168.4.1/"); setupServer.send(302, "text/plain", "Setup"); return;
    }
    String html(SETUP_PAGE);
    html.replace("__SSID__", escapeHTML(wifiName)); html.replace("__SERVER__", escapeHTML(serverBase));
    html.replace("__HAS_PASSWORD__", wifiPassword.isEmpty() ? "false" : "true");
    String choices = "<option value=\"\">Choose a saved connection</option>";
    for (int i = 0; i < 3; ++i) {
      const String name = prefs.getString(("net" + String(i)).c_str(), "");
      if (name.isEmpty()) continue;
      choices += "<option value=\"" + escapeHTML(name) + "\" data-server=\""
        + escapeHTML(prefs.getString(("url" + String(i)).c_str(), "")) + "\" data-secured=\""
        + (prefs.getString(("key" + String(i)).c_str(), "").isEmpty() ? "false" : "true") + "\">" + escapeHTML(name) + "</option>";
    }
    html.replace("__SAVED_CONNECTIONS__", choices);
    setupServer.sendHeader("Cache-Control", "no-store");
    setupServer.send(200, "text/html", html);
  });
  setupServer.on("/status", HTTP_GET, []() {
    if (!isSetupClient()) { setupServer.send(403, "text/plain", "Use the device setup Wi-Fi"); return; }
    setupServer.sendHeader("Cache-Control", "no-store");
    setupServer.send(200, "application/json", String("{\"failed\":") + (connectFailed ? "true" : "false")
      + ",\"wifiConnected\":" + (WiFi.status() == WL_CONNECTED ? "true" : "false") + "}");
  });
  setupServer.on("/networks", HTTP_GET, []() {
    if (!isSetupClient()) { setupServer.send(403, "text/plain", "Use the device setup Wi-Fi"); return; }
    if (connecting) { setupServer.send(409, "text/plain", "Wait for connection attempt"); return; }
    const int count = WiFi.scanComplete();
    setupServer.sendHeader("Cache-Control", "no-store");
    if (count == WIFI_SCAN_FAILED) WiFi.scanNetworks(true);
    if (count < 0) { setupServer.send(200, "application/json", "{\"scanning\":true,\"networks\":[]}"); return; }
    String json = "{\"scanning\":false,\"networks\":[";
    for (int i = 0; i < count && i < 20; ++i) {
      if (i) json += ',';
      String name = WiFi.SSID(i); json += '"';
      for (unsigned j = 0; j < name.length(); ++j) {
        const uint8_t c = name[j];
        if (c == '"' || c == '\\') { json += '\\'; json += char(c); }
        else if (c < 32) { char escaped[7]; snprintf(escaped, sizeof(escaped), "\\u%04x", c); json += escaped; }
        else json += char(c);
      }
      json += '"';
    }
    json += "]}"; WiFi.scanDelete();
    setupServer.send(200, "application/json", json);
  });
  setupServer.on("/save", HTTP_POST, []() {
    if (!isSetupClient()) { setupServer.send(403, "text/plain", "Use the device setup Wi-Fi"); return; }
    const String origin = setupServer.header("Origin");
    if (!cyd::setupOriginAllowed(origin.c_str())) { setupServer.send(403, "text/plain", "Open http://192.168.4.1"); return; }
    if (connecting) { setupServer.send(409, "text/plain", "Connection in progress"); return; }
    String name = setupServer.arg("ssid"), password = setupServer.arg("password"), url = setupServer.arg("server");
    const bool openNetwork = setupServer.arg("open") == "1";
    if (openNetwork) password = "";
    else if (cyd::reuseWifiPassword(wifiName.c_str(), name.c_str(), password.c_str(), false)) password = wifiPassword;
    if (!openNetwork && password.isEmpty()) {
      for (int i = 0; i < 3; ++i) if (prefs.getString(("net" + String(i)).c_str(), "") == name)
        password = prefs.getString(("key" + String(i)).c_str(), "");
    }
    if (!openNetwork && password.isEmpty()) {
      setupServer.send(400, "text/plain", "Enter the password for this network, or explicitly select an open network."); return;
    }
    url.trim();
    while (url.endsWith("/")) url.remove(url.length() - 1);
    if (name.isEmpty() || name.length() > 32 || password.length() > 63 || (!password.isEmpty() && password.length() < 8)
        || !url.startsWith("http://") || url.length() > 180
        || url.indexOf('\n') >= 0 || url.indexOf('\r') >= 0
        || url.substring(7).indexOf('/') >= 0 || url.indexOf('@') >= 0
        || url.indexOf('?') >= 0 || url.indexOf('#') >= 0 || url.indexOf(' ') >= 0
        || url.substring(7).isEmpty()) {
      setupServer.send(400, "text/plain", "Use a 2.4 GHz Wi-Fi name, an 8-63 character password (or blank for open Wi-Fi), and http://MAC_LAN_IP:3088."); return;
    }
    // Do not log, return or embed the submitted network password.
    wifiName = name; wifiPassword = password; serverBase = url;
    frameStatus = "not checked";
    prefs.putString("ssid", wifiName); prefs.putString("wifi-pass", wifiPassword); prefs.putString("server", serverBase);
    rememberConnection();
    setupServer.sendHeader("Cache-Control", "no-store");
    setupServer.send(200, "text/html", "<h1>Saved</h1><p>Check the CYD status. Return to home Wi-Fi, or enable your 2.4 GHz hotspot. If it fails, reconnect to CYD setup Wi-Fi.</p>");
    showLauncher();
    beginWiFi();
  });
  setupServer.onNotFound([]() {
    if (isSetupClient()) { setupServer.sendHeader("Location", "http://192.168.4.1/"); setupServer.send(302, "text/plain", "Setup"); }
    else setupServer.send(404, "text/plain", "Not found");
  });
}

void startOTA() {
  ArduinoOTA.setHostname(deviceName.c_str());
  ArduinoOTA.setPassword(setupPassword.c_str());
  ArduinoOTA.onStart([]() { updating = true; showMessage("Updating firmware", "Keep the board powered.\nIt will restart when finished."); });
  ArduinoOTA.onError([](ota_error_t) { updating = false; showMessage("Update failed", "The existing viewer is still running."); });
  ArduinoOTA.begin();
  otaStarted = true;
}

bool fetchFrame() {
  // Keep one bounded HTTP connection, not a new TCP handshake per image.
  static WiFiClient client;
  static HTTPClient http;
  static String connectionBase;
  if (connectionBase != serverBase) { client.stop(); http.end(); connectionBase = serverBase; }
  http.setReuse(true);
  const auto failed = [&]() { client.stop(); http.end(); return false; };
  const uint32_t started = millis();
  if (!wifiWindowStart) wifiWindowStart = started;
  // Bound failed bridge requests so the local waiting game remains playable.
  http.setConnectTimeout(haveFrame ? 500 : 120); http.setTimeout(haveFrame ? 600 : 150);
  if (!http.begin(client, serverBase + "/frame.jpg")) return failed();
  const char* headers[] = {"X-Frame-Age-Ms"};
  http.collectHeaders(headers, 1);
  http.setUserAgent("CYD-Pixsim/launcher-v1");
  const int code = http.GET();
  frameStatus = code < 0 ? "unreachable" : "HTTP " + String(code);
  const int size = http.getSize();
  if (code != 200 || size < 4 || size > int(MAX_JPEG)) {
    Serial.printf("Frame HTTP status=%d length=%d\n", code, size);
    return failed();
  }
  if (http.hasHeader("X-Frame-Age-Ms") && http.header("X-Frame-Age-Ms").toInt() > 3000) { frameStatus = "stale image"; return failed(); }
  auto* stream = http.getStreamPtr();
  if (!stream) { frameStatus = "connection closed"; return failed(); }
  const size_t received = stream->readBytes(jpegBuffer, size);
  http.end();
  if (received != size || jpegBuffer[0] != 0xff || jpegBuffer[1] != 0xd8
      || jpegBuffer[size - 2] != 0xff || jpegBuffer[size - 1] != 0xd9) { frameStatus = "bad image"; return failed(); }
  receiveMs = millis() - started;
  const uint32_t drawing = millis();
  if (!drawRemoteJpeg(jpegBuffer, size)) { frameStatus = "decode failed"; return failed(); }
  drawMs = millis() - drawing;
  frameStatus = "live";
  if (!haveFrame) Serial.println("First JPEG downloaded and drawn.");
  if (launcherVisible) touchOwner = cyd::TouchTarget::Ignore;
  launcherVisible = false; setupDetails = false;
  bridgeEditing = false; pressedAddressKey = -1;
  receiverRetryTouch = receiverSettingsTouch = receiverAddressTouch = false;
  haveFrame = true; lastGoodFrame = millis(); frames++;
  displayRate.add(lastGoodFrame, false);
  ++wifiWindowDraws;
  const uint32_t windowMs = millis() - wifiWindowStart;
  if (windowMs >= 5000) {
    measuredFpsTenths = uint32_t(uint64_t(wifiWindowDraws) * 10000 / windowMs);
    Serial.printf("CYDPERF draws=%lu window_ms=%lu receive_ms=%lu draw_ms=%lu\n", (unsigned long)wifiWindowDraws, (unsigned long)windowMs, (unsigned long)receiveMs, (unsigned long)drawMs);
    wifiWindowDraws = 0; wifiWindowStart = millis();
  }
  drawNetworkStatus(true);
  return true;
}

void forwardTouch(char phase, bool overUSB) {
  static uint16_t previousX = 0, previousY = 0;
  uint16_t remoteX = lastTouchX, remoteY = lastTouchY;
  if (cyd::remotePoint(remoteX, remoteY)) { previousX = remoteX; previousY = remoteY; }
  else if (phase == 'U') { remoteX = previousX; remoteY = previousY; }
  else return;
  if (overUSB) Serial.printf("USBTOUCH %c %u %u\n", phase, remoteX, remoteY);
  else if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client; HTTPClient http;
    http.setConnectTimeout(300); http.setTimeout(300);
    if (http.begin(client, serverBase + "/input")) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-Input-Source", "cyd");
      const char* name = phase == 'D' ? "down" : phase == 'M' ? "move" : "up";
      const String body = "{\"action\":\"pointer\",\"phase\":\"" + String(name)
        + "\",\"x\":" + String(remoteX) + ",\"y\":" + String(remoteY) + "}";
      const int result = http.POST(body);
      if (result != 200) Serial.printf("Pointer input status=%d\n", result);
      http.end();
    }
  }
}

void touchInput() {
  if (millis() - lastTouchPoll < 20) return;
  lastTouchPoll = millis();
  uint16_t x, y;
  const bool touched = screen.getTouch(&x, &y) && x < SCREEN_WIDTH && y < SCREEN_HEIGHT;
  char phase = 0;
  if (touched) {
    missingTouchSamples = 0;
    if (!wasTouched) phase = 'D';
    else if (x != lastTouchX || y != lastTouchY || millis() - lastTouchEvent >= 200) phase = 'M';
    wasTouched = true; lastTouchX = x; lastTouchY = y;
  } else if (wasTouched && ++missingTouchSamples >= 2) {
    wasTouched = false; missingTouchSamples = 0; phase = 'U';
  }
  if (!phase) return;
  lastTouchEvent = millis();
  if (!bridgeEditing) {
    if (phase == 'D') wizardPressedTab = cyd::wizardTab(lastTouchX, lastTouchY);
    if (wizardPressedTab >= 0) {
      if (phase == 'U') {
        const int tab = wizardPressedTab; wizardPressedTab = -1;
        if (tab == cyd::wizardTab(lastTouchX, lastTouchY)) {
          openWizardPage(tab);
        }
      }
      return;
    }
  }
  if (launcherVisible && !bridgeEditing && (!setupDetails || setupStep < 2)) {
    if (phase == 'D') checklistTouch = cyd::checklistHit(lastTouchX, lastTouchY);
    if (checklistTouch) {
      if (phase == 'U') {
        checklistTouch = false;
        if (cyd::checklistHit(lastTouchX, lastTouchY)) {
          const uint8_t page = setupDetails ? setupStep + 1 : 0;
          stepDone[page] = !stepDone[page];
          drawChecklist(page); drawWizardTabs(page);
        }
      }
      return;
    }
  }
  if (launcherVisible && !bridgeEditing) {
    if (phase == 'D') wizardGesture.begin(lastTouchX, lastTouchY);
    if (phase == 'U') {
      const int direction = wizardGesture.finish(lastTouchX, lastTouchY);
      if (direction) {
        const int current = setupDetails ? setupStep + 1 : 0;
        const int target = constrain(current + direction, 0, 3);
        if (target != current) {
          openWizardPage(target);
        }
        return;
      }
    }
  }
  if (setupDetails) {
    if (phase == 'D') setupPressedKey = cyd::setupNavigationKey(lastTouchX, lastTouchY);
    if (phase == 'U') {
      const int key = setupPressedKey; setupPressedKey = -1;
      if (key >= 0 && key == cyd::setupNavigationKey(lastTouchX, lastTouchY)) {
        if (key == 1 && setupStep == 2) { ESP.restart(); return; }
        else if (key == 0) openWizardPage(setupStep);
        else {
          const uint8_t current = setupStep + 1;
          stepDone[current] = true;
          openWizardPage(cyd::nextWizardPage(current));
        }
      }
    }
    return;
  }
  if (bridgeEditing) {
    if (phase == 'D') pressedAddressKey = cyd::addressKey(lastTouchX, lastTouchY);
    if (phase == 'U') {
      const int key = pressedAddressKey; pressedAddressKey = -1;
      if (key >= 0 && key == cyd::addressKey(lastTouchX, lastTouchY)) addressInput(key);
    }
    return;
  }
  if (phase == 'D') {
    receiverAddressTouch = launcherVisible && !setupDetails && cyd::receiverAddressHit(lastTouchX, lastTouchY);
    receiverRetryTouch = launcherVisible && !setupDetails && cyd::receiverRetryHit(lastTouchX, lastTouchY);
    receiverSettingsTouch = launcherVisible && !setupDetails && cyd::receiverSettingsHit(lastTouchX, lastTouchY);
    touchOwner = launcherVisible ? cyd::touchTarget(lastTouchX, lastTouchY, true, setupDetails) : cyd::TouchTarget::Remote;
    if (!launcherVisible) { uint16_t rx = lastTouchX, ry = lastTouchY; if (!cyd::remotePoint(rx, ry)) touchOwner = cyd::TouchTarget::Ignore; }
    if (launcherVisible && !setupDetails && touchOwner == cyd::TouchTarget::Snake) touchOwner = cyd::TouchTarget::Ignore;
    touchOverUSB = usbActive;
    swipe.begin(lastTouchX, lastTouchY);
  }
  if (phase == 'U' && launcherVisible && !setupDetails && receiverRetryTouch && cyd::receiverRetryHit(lastTouchX, lastTouchY)) {
    for (bool& done : stepDone) done = false;
    drawWizardTabs(0); drawNetworkStatus(true);
  }
  if (phase == 'U' && launcherVisible && !setupDetails && receiverSettingsTouch && cyd::receiverSettingsHit(lastTouchX, lastTouchY)) {
    stepDone[0] = true; setupRequested = true;
  }
  if (phase == 'U' && launcherVisible && !setupDetails && receiverAddressTouch && cyd::receiverAddressHit(lastTouchX, lastTouchY)) {
    setupRequested = true;
    touchOwner = cyd::TouchTarget::Ignore;
    return;
  }
  if (touchOwner == cyd::TouchTarget::Remote) forwardTouch(phase, touchOverUSB);
  else if (touchOwner == cyd::TouchTarget::Snake) {
    cyd::Direction direction;
    if (swipe.sample(lastTouchX, lastTouchY, direction) && snake.turn(direction)) snakePlaying = true;
    if (phase == 'U' && !swipe.used && !snake.alive) {
      snake.reset(esp_random()); snakePlaying = false; lastSnakeStep = millis(); drawSnake();
    }
  } else if (phase == 'U' && touchOwner == cyd::TouchTarget::Network && cyd::networkHit(lastTouchX, lastTouchY, !launcherVisible && !setupDetails)) {
    setupRequested = true;
  } else if (phase == 'U' && touchOwner == cyd::TouchTarget::Play && lastTouchY >= 270) {
    showLauncher();
  }
  if (phase == 'U') touchOwner = cyd::TouchTarget::None;
}

void readUSBFrame() {
  static const char magic[] = "CYDJPEG\n";
  static const char hello[] = "CYDHELLO\n";
  size_t budget = 4096;
  if (controlLine.active && millis() - usbLastByte > 1000) controlLine.reset();
  if (usbStage && millis() - usbLastByte > 5000) {
    usbStage = 0; usbMatch = 0;
    Serial.println("USBFRAME ERROR timeout");
  }
  while (Serial.available() && budget) {
    usbLastByte = millis();
    if (usbStage == 2) {
      const size_t count = min(budget, min(size_t(Serial.available()), size_t(usbExpected - usbReceived)));
      // While provisioning, finish consuming old packets without touching the
      // shared JPEG buffer or drawing over the local UI.
      if (usbPaused) {
        for (size_t i = 0; i < count; ++i) Serial.read();
        usbReceived += count;
      } else usbReceived += Serial.read(jpegBuffer + usbReceived, count);
      budget -= count;
      if (usbReceived != usbExpected) continue;
      const bool valid = !usbPaused && jpegBuffer[0] == 0xff && jpegBuffer[1] == 0xd8
        && jpegBuffer[usbExpected - 2] == 0xff && jpegBuffer[usbExpected - 1] == 0xd9;
      if (usbPaused) Serial.println("USBFRAME PAUSED");
      else if (valid && drawRemoteJpeg(jpegBuffer, usbExpected)) {
        if (launcherVisible) touchOwner = cyd::TouchTarget::Ignore;
        launcherVisible = false; setupDetails = false;
        bridgeEditing = false; pressedAddressKey = -1;
        receiverRetryTouch = receiverSettingsTouch = receiverAddressTouch = false;
        haveFrame = true; usbActive = usbSession.owned = true; usbLastFrame = lastGoodFrame = millis(); frames++;
        displayRate.add(lastGoodFrame, true);
        baudProgressAt = millis();
        drawNetworkStatus(true);
        Serial.printf("USBFRAME OK %lu\n", (unsigned long)frames);
        Serial.flush();
      } else Serial.println("USBFRAME ERROR decode");
      usbStage = 0; usbMatch = 0;
    } else {
      const uint8_t value = Serial.read();
      budget--;
      if (usbStage == 0) {
        if (controlLine.consume(value)) {
          usbHelloMatch = usbMatch = 0;
          if (controlLine.complete) {
            if (controlLine.overflow) Serial.println("CYDCONTROL ERROR length");
            else handleControl(controlLine.text);
            controlLine.reset();
          }
          continue;
        }
        usbHelloMatch = value == hello[usbHelloMatch] ? usbHelloMatch + 1 : (value == hello[0] ? 1 : 0);
        if (usbHelloMatch == sizeof(hello) - 1) {
          // A fresh, explicit host connection is the USB fallback. The updated
          // helper exits on USBSETUP REQUEST instead of retrying this handshake.
          if (portal) closePortal();
          usbPaused = false; setupDetails = false;
           usbActive = usbSession.owned = true;  // Reserve USB mode before acknowledging; suppress HTTP downloads.
           usbLastFrame = millis();  // First-image deadline also applies if no image ever arrives.
           Serial.printf("CYDREADY2 %u %u %lu\n", SCREEN_WIDTH, SCREEN_HEIGHT, (unsigned long)usbBaud);
          Serial.flush(); usbHelloMatch = 0;
        }
        usbMatch = value == magic[usbMatch] ? usbMatch + 1 : (value == magic[0] ? 1 : 0);
        if (usbMatch == sizeof(magic) - 1) { usbStage = 1; usbLengthCount = 0; usbMatch = 0; }
      } else {
        usbLengthBytes[usbLengthCount++] = value;
        if (usbLengthCount == 4) {
          usbExpected = uint32_t(usbLengthBytes[0]) | (uint32_t(usbLengthBytes[1]) << 8)
            | (uint32_t(usbLengthBytes[2]) << 16) | (uint32_t(usbLengthBytes[3]) << 24);
          usbReceived = 0;
          if (usbExpected >= 4 && usbExpected <= MAX_JPEG) usbStage = 2;
          else { usbStage = 0; Serial.println("USBFRAME ERROR length"); }
        }
      }
    }
  }
  // Idle transport falls back to the local launcher in loop().
}

void handleControl(const char* command) {
  if (!strcmp(command, "?CYDSTATUS")) {
    cyd::BridgeAddress parsed;
    const String safeBridge = cyd::parseBridgeAddress(serverBase.c_str(), parsed) ? serverBase : "custom";
    Serial.printf("CYDSTATUS {\"wifi\":%s,\"portal\":%s,\"editing\":%s,\"usb\":%s,\"bridge\":\"%s\",\"frames\":%lu,\"errors\":%lu,\"spi_mhz\":%lu,\"heap\":%lu,\"rssi\":%d}\n",
      WiFi.status() == WL_CONNECTED ? "true" : "false", portal ? "true" : "false", bridgeEditing ? "true" : "false", usbActive ? "true" : "false", safeBridge.c_str(),
      (unsigned long)frames, (unsigned long)errors, (unsigned long)writeMHz, (unsigned long)ESP.getFreeHeap(), WiFi.RSSI());
    return;
  }
  if (updating) { Serial.println("CYDCONTROL ERROR updating"); return; }
  const uint32_t baud = cyd::experimentBaud(command);
  if (baud) {
    Serial.println("CYDCONTROL OK baud"); Serial.flush();
    delay(30);
    Serial.updateBaudRate(baud); usbBaud = baud;
    baudExperiment = baud != USB_BAUD; baudProgressAt = millis();
    return;
  }
  const uint32_t mhz = cyd::experimentClock(command);
  if (mhz) {
    screen.setWriteMHz(mhz); writeMHz = mhz; clockExperiment = mhz != 24; clockExperimentAt = millis();
    wifiWindowStart = millis(); wifiWindowDraws = 0;
    Serial.println("CYDCONTROL OK spi"); return;
  }
  if (!strncmp(command, "?CYDBRIDGE=", 11)) {
    cyd::BridgeAddress parsed;
    const char* url = command + 11;
    if (!cyd::parseBridgeAddress(url, parsed) || strlen(url) > 180) { Serial.println("CYDCONTROL ERROR bridge"); return; }
    if (!prefs.putString("server", url)) { Serial.println("CYDCONTROL ERROR save"); return; }
    serverBase = url;
    if (!wifiName.isEmpty()) rememberConnection();
    retryRequested = true;
    Serial.println("CYDCONTROL OK bridge"); return;
  }
  if (!strcmp(command, "?CYDRESUME")) {
    if (wifiName.isEmpty()) { Serial.println("CYDCONTROL ERROR wifi-not-configured"); return; }
    retryRequested = true; Serial.println("CYDCONTROL OK resume"); return;
  }
  Serial.println("CYDCONTROL ERROR command");
}

void setup() {
  Serial.setRxBufferSize(16384);
  Serial.begin(USB_BAUD);
  pinMode(0, INPUT_PULLUP);
  prefs.begin("cyd-pixsim", false);
  // Enable the Wi-Fi radio before generating credentials, for hardware RNG entropy.
  WiFi.mode(WIFI_STA);
  deviceName = "CYD-Pixsim-" + String(uint32_t(ESP.getEfuseMac() >> 32), HEX);
  setupPassword = prefs.getString("setup-pass", "");
  if (setupPassword.isEmpty()) {
    char value[17]; snprintf(value, sizeof(value), "%08lx%08lx", (unsigned long)esp_random(), (unsigned long)esp_random());
    setupPassword = value; prefs.putString("setup-pass", setupPassword);
  }
  wifiName = prefs.getString("ssid", ""); wifiPassword = prefs.getString("wifi-pass", "");
  serverBase = prefs.getString("server", "http://192.168.178.237:3088");
  screen.init(); screen.setRotation(0); screen.setBrightness(180);
  screen.setTextWrap(false);
#ifdef CYD_BOARD_ESP32_024
  // The resistive panel needs its own calibration, never the capacitive profile.
  uint16_t touchCalibration[8];
  if (prefs.getBytesLength("touch-024") == sizeof(touchCalibration)) {
    prefs.getBytes("touch-024", touchCalibration, sizeof(touchCalibration));
    screen.setTouchCalibrate(touchCalibration);
  } else {
    screen.fillScreen(TFT_WHITE);
    screen.setTextColor(TFT_BLACK, TFT_WHITE);
    screen.setCursor(25, 130);
    screen.print("Touch the corner targets");
    Serial.println("CYDCAL START board=esp32-024");
    screen.calibrateTouch(touchCalibration, TFT_BLACK, TFT_WHITE, 15);
    prefs.putBytes("touch-024", touchCalibration, sizeof(touchCalibration));
    Serial.println("CYDCAL OK board=esp32-024");
  }
#endif
  snake.reset(esp_random()); showLauncher();
  Serial.println("CYD Pixsim viewer: display initialized (240x320 portrait).");
  jpegBuffer = static_cast<uint8_t*>(malloc(MAX_JPEG));
  if (!jpegBuffer) { showMessage("Not enough memory", "JPEG buffer allocation failed."); return; }
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  setupRoutes();
  if (!wifiName.isEmpty()) { WiFi.mode(WIFI_STA); beginWiFi(); }
  Serial.println("CYDUI READY snake=1 wifi=touch version=1");
}

void loop() {
  if (!jpegBuffer) { delay(100); return; }
  if (baudExperiment && cyd::baudIdleExpired(millis(), baudProgressAt) && !usbStage && !updating) {
    Serial.flush(); Serial.updateBaudRate(USB_BAUD);
    usbBaud = USB_BAUD; baudExperiment = false;
    controlLine.reset(); usbMatch = usbHelloMatch = 0;
    Serial.println("CYDCONTROL OK baud-fallback");
  }
  // Experimental clocks are RAM-only and automatically fall back within90 seconds.
  if (clockExperiment && millis() - clockExperimentAt >= 90000 && !updating) {
    screen.setWriteMHz(24); writeMHz = 24; clockExperiment = false;
    Serial.println("CYDCONTROL OK spi-fallback");
  }
  // Never mix HTTP downloads with an in-progress USB frame in the shared buffer.
  readUSBFrame();
  touchInput();
  // Hold BOOT while the app is running, not while resetting/connecting power.
  if (digitalRead(0) == LOW) {
    if (!bootHeldAt) bootHeldAt = millis();
    if ((!setupDetails || usbActive) && millis() - bootHeldAt >= 3000) setupRequested = true;
  } else {
    if (bootHeldAt && millis() - bootHeldAt >= 40 && millis() - bootHeldAt < 1500 && haveFrame && !launcherVisible) debugOverlay = !debugOverlay;
    bootHeldAt = 0;
  }
  // Defer handover until the current JPEG is completely consumed and ACKed.
  if (setupRequested && !usbStage && !updating) {
    if (touchOwner == cyd::TouchTarget::Remote) forwardTouch('U', touchOverUSB);
    touchOwner = cyd::TouchTarget::Ignore;
    setupRequested = false; startPortal(0);
  }
  if (portal) { dns.processNextRequest(); setupServer.handleClient(); }
  if (retryRequested && !usbStage && !updating) {
    retryRequested = false;
    if (usbSession.pause()) { Serial.println("USBSETUP REQUEST"); Serial.flush(); }
    usbActive = false; usbPaused = true;
    closePortal(); wifiRetry.reset(); streamRetry.reset(); frameStatus = "checking...";
    if (!wifiName.isEmpty() && WiFi.status() != WL_CONNECTED) beginWiFi();
    else showLauncher();
  }
  const bool usbExpired = usbActive && cyd::usbIdleExpired(millis(), usbLastFrame);
  if (((haveFrame && millis() - lastGoodFrame >= 4000) || usbExpired) && !usbStage && !updating) {
    if (touchOwner == cyd::TouchTarget::Remote) forwardTouch('U', touchOverUSB);
    usbActive = false; usbSession.owned = false; showLauncher();
    Serial.println("CYDUI waiting; receiver active");
  }
  if (launcherVisible && !setupDetails && !updating && millis() - lastSnakeStep >= 140) {
    lastSnakeStep = millis();
    if (snake.alive && snakePlaying) { snake.step(esp_random()); drawSnake(); }
  }
  if (!updating) drawNetworkStatus();
  if (bridgeEditing && !updating) { if (otaStarted) ArduinoOTA.handle(); delay(5); return; }
  // A paused USB packet is discarded, not written into the HTTP JPEG buffer.
  if (usbStage && !usbPaused) { delay(1); return; }
  if (usbActive && !updating) {
    if (otaStarted) ArduinoOTA.handle();
    delay(1); return;
  }
  if (connecting && millis() - connectStarted > 20000 && WiFi.status() != WL_CONNECTED) {
    connecting = false; portalConnecting = false; connectFailed = true;
    WiFi.disconnect(false, false);
    wifiRetry.failed(millis());
    drawNetworkStatus(true);
    Serial.println("Wi-Fi join timed out; setup remains available");
  }
  if (WiFi.status() != WL_CONNECTED) {
    if (!portal && !connecting && !wifiName.isEmpty() && wifiRetry.ready(millis())) beginWiFi();
    delay(5); return;
  }
  wifiRetry.reset();
  connecting = false; connectFailed = false;
  if (portal && portalConnecting && digitalRead(0) != LOW) {
    closePortal(); showLauncher();
    Serial.print("Wi-Fi connected. Device IP: "); Serial.println(WiFi.localIP());
  }
  if (!otaStarted) startOTA();
  ArduinoOTA.handle();
  if (updating || portal || setupDetails) { delay(5); return; }
  if (streamRetry.ready(millis())) {
    lastFrameAt = millis();
    if (!fetchFrame()) {
      errors++;
      streamRetry.failed(millis());
    } else streamRetry.succeeded(millis());
    if (frames && frames % 40 == 0) Serial.printf("Frames=%lu errors=%lu heap=%lu\n", (unsigned long)frames, (unsigned long)errors, (unsigned long)ESP.getFreeHeap());
  }
  delay(5);
}
