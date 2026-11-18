// inkcard firmware: shows a 296x128 black and white card on a 2.9" e-paper panel.
// The editor sends the image over USB serial; it is kept in flash and redrawn on every reset.
// The panel keeps the picture with the power off, so the board sleeps right after drawing.

#include <GxEPD2_BW.h>
#include <Fonts/FreeSansBold12pt7b.h>
#include <LittleFS.h>
#include "esp_sleep.h"

// Waveshare 2.9" V2. For other 2.9" panels try GxEPD2_290 (V1), GxEPD2_290_BS or GxEPD2_290_T5D.
#define PANEL GxEPD2_290_T94_V2

// ESP32 DevKit wiring. SPI clock and data use the default pins: CLK 18, DIN 23.
const int PIN_CS = 5, PIN_DC = 17, PIN_RST = 16, PIN_BUSY = 4;

GxEPD2_BW<PANEL, PANEL::HEIGHT> display(PANEL(PIN_CS, PIN_DC, PIN_RST, PIN_BUSY));

const int W = 296, H = 128, SIZE = W / 8 * H;
const char *IMAGE = "/card.bin";
const uint32_t LISTEN_MS = 3000;
uint8_t img[SIZE];

// Frame from the editor: "INK1", length (2 bytes, little endian), image, 1 byte sum of the image bytes
bool receive() {
  const uint8_t magic[] = {'I', 'N', 'K', '1'};
  int matched = 0;
  uint32_t start = millis();
  while (matched < 4 && millis() - start < LISTEN_MS) {
    if (!Serial.available()) { delay(2); continue; }
    uint8_t b = Serial.read();
    matched = b == magic[matched] ? matched + 1 : (b == magic[0] ? 1 : 0);
  }
  if (matched < 4) return false;

  Serial.setTimeout(3000);
  uint8_t len[2], sum = 0, check;
  if (Serial.readBytes(len, 2) != 2 || (len[0] | len[1] << 8) != SIZE) { Serial.println("ERR size"); return false; }
  if (Serial.readBytes(img, SIZE) != SIZE) { Serial.println("ERR timeout"); return false; }
  for (int i = 0; i < SIZE; i++) sum += img[i];
  if (Serial.readBytes(&check, 1) != 1 || check != sum) { Serial.println("ERR checksum"); return false; }
  return true;
}

bool load() {
  File f = LittleFS.open(IMAGE, "r");
  if (!f) return false;
  bool ok = f.read(img, SIZE) == SIZE;
  f.close();
  return ok;
}

bool save() {
  File f = LittleFS.open(IMAGE, "w");
  if (!f) return false;
  bool ok = f.write(img, SIZE) == SIZE;
  f.close();
  return ok;
}

void drawImage() {
  display.setRotation(1);
  display.setFullWindow();
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.drawBitmap(0, 0, img, W, H, GxEPD_BLACK);
  } while (display.nextPage());
}

void drawHelp() {
  display.setRotation(1);
  display.setFullWindow();
  display.setTextColor(GxEPD_BLACK);
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.setFont(&FreeSansBold12pt7b);
    display.setCursor(12, 34);
    display.print("inkcard");
    display.setFont(nullptr);
    display.setCursor(12, 58);
    display.print("No card yet. Open the inkcard editor,");
    display.setCursor(12, 72);
    display.print("connect this board over USB and");
    display.setCursor(12, 86);
    display.print("press Send to card.");
  } while (display.nextPage());
}

void setup() {
  Serial.begin(115200);
  delay(20);
  Serial.printf("\nINKCARD READY %d %d\n", W, H);

  LittleFS.begin(true);
  bool fresh = receive();
  bool saved = fresh && save();

  display.init(0, true, 2, false);
  if (fresh || load()) drawImage();
  else drawHelp();
  display.hibernate();

  if (fresh) Serial.println(saved ? "OK" : "ERR flash");
  Serial.flush();
  esp_deep_sleep_start();
}

void loop() {}
