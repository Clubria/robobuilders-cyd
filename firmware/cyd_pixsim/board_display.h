#pragma once
#define LGFX_USE_V1
#include <LovyanGFX.hpp>

// Default: GUITION JC2432W328, confirmed by the user's rear-label photo.
// Pin reference: openHASP/user_setups/esp32/guition-jc2432w328.ini
// CYD_BOARD_ESP32_024 selects the photographed ESP32-024 ST7789/XPT2046.
// Its vendor schematic confirms BL27 and shared SPI14/13/12, touch CS33/IRQ36.
class CydDisplay : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789 panel;
  lgfx::Bus_SPI bus;
  lgfx::Light_PWM light;
#ifdef CYD_BOARD_ESP32_024
  lgfx::Touch_XPT2046 touch;
#else
  // CST820 uses the CST8xx register protocol supported by this driver.
  lgfx::Touch_CST816S touch;
#endif

  public:
    // Experiments run only between complete draws; default/reboot remains24 MHz.
    void setWriteMHz(uint32_t mhz) { bus.setClock(mhz * 1000000u); }
    CydDisplay() {
    auto b = bus.config();
    b.spi_host = SPI2_HOST;
#ifdef CYD_BOARD_ESP32_024
    b.spi_mode = 3;
#else
    b.spi_mode = 0;
#endif
    b.freq_write = 24000000;
    b.freq_read = 10000000;
    b.spi_3wire = false;
    b.use_lock = true;
    b.dma_channel = SPI_DMA_CH_AUTO;
    b.pin_sclk = 14;
    b.pin_mosi = 13;
    b.pin_miso = 12;
    b.pin_dc = 2;
    bus.config(b);
    panel.setBus(&bus);

    auto p = panel.config();
    p.pin_cs = 15;
    p.pin_rst = -1;
    p.panel_width = 240;
    p.panel_height = 320;
    p.offset_x = 0;
    p.offset_y = 0;
    p.offset_rotation = 0;
    p.readable = false;
    p.invert = false;
    p.rgb_order = false;
#ifdef CYD_BOARD_ESP32_024
    p.bus_shared = true;
#else
    p.bus_shared = false;
#endif
    panel.config(p);

    auto l = light.config();
    l.pin_bl = 27;
    l.invert = false;
    l.freq = 5000;
    l.pwm_channel = 7;
    light.config(l);
    panel.setLight(&light);

    auto t = touch.config();
#ifdef CYD_BOARD_ESP32_024
    t.spi_host = SPI2_HOST;
    t.pin_sclk = 14;
    t.pin_mosi = 13;
    t.pin_miso = 12;
    t.pin_cs = 33;
    t.pin_int = 36;
    t.freq = 1000000;
    t.bus_shared = true;
    // Raw ADC range until the first-boot calibration replaces it.
    t.x_min = 200;
    t.x_max = 3900;
    t.y_min = 200;
    t.y_max = 3900;
#else
    t.i2c_port = 0;  // I2C controller 0, compatible with Arduino ESP32 3.x headers.
    t.i2c_addr = 0x15;
    t.pin_sda = 33;
    t.pin_scl = 32;
    t.pin_rst = 25;
    t.pin_int = -1;
    t.freq = 400000;
    t.x_min = 0;
    t.x_max = 239;
    t.y_min = 0;
    t.y_max = 319;
#endif
    t.offset_rotation = 0;
    touch.config(t);
    panel.setTouch(&touch);
    setPanel(&panel);
  }
};
