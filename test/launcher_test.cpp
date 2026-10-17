#include <assert.h>
#include <string.h>
#include <initializer_list>
#include "../firmware/cyd_pixsim/launcher.h"
#include "../firmware/cyd_pixsim/bridge_address.h"
#include "../firmware/cyd_pixsim/receiver_control.h"

int main() {
  using namespace cyd;
  ControlLine control;
  assert(!control.consume('C'));
  for (const char byte : "?CYDSTATUS\n") { if (byte) assert(control.consume(byte)); }
  assert(control.complete && !control.overflow && !strcmp(control.text, "?CYDSTATUS"));
  control.reset();
  control.consume('?'); for (int i=0;i<1000;++i) control.consume('x'); control.consume('\n');
  assert(control.complete && control.overflow && control.length < sizeof(control.text));
  control.reset(); control.consume('?'); control.consume(0); control.consume('\n'); assert(control.overflow);
  control.reset(); for (const char byte : "?CYDSTATUS\r\n") if (byte) control.consume(byte); assert(control.complete && !control.overflow);
  control.reset(); for (const char byte : "?CYDRE\rSUME\n") if (byte) control.consume(byte); assert(control.complete && control.overflow);
  assert(experimentClock("?CYDSPI=24") == 24 && experimentClock("?CYDSPI=40") == 40);
  assert(!experimentClock("?CYDSPI=80") && !experimentClock("?CYDSPI=40junk"));
  assert(experimentBaud("?CYDBAUD=115200") == 115200 && experimentBaud("?CYDBAUD=460800") == 460800);
  assert(!experimentBaud("?CYDBAUD=921600") && !experimentBaud("?CYDBAUD=460800junk"));
  assert(!baudIdleExpired(29999, 0) && baudIdleExpired(30000, 0));
  assert(baudIdleExpired(28999, UINT32_MAX - 1000));
  BridgeAddress address;
  assert(parseBridgeAddress("http://192.168.178.237:3088", address));
  assert(address.ip[0] == 192 && address.ip[3] == 237 && address.port == 3088);
  assert(parseBridgeAddress("http://10.0.0.1", address) && address.port == 80);
  for (const char* invalid : {"https://192.168.1.1:3088", "http://256.1.1.1:3088", "http://1.2.3.4:0", "http://1.2.3.4:65536", "http://1.2.3", "http://1.2.3.4/preview", "http://localhost:3088", "http://user@1.2.3.4"}) assert(!parseBridgeAddress(invalid, address));
  unsigned octet;
  assert(parseLastOctet("61", octet) && octet == 61);
  assert(parseLastOctet("255", octet) && !parseLastOctet("256", octet));
  assert(!parseLastOctet("", octet) && !parseLastOctet("-1", octet) && !parseLastOctet("61x", octet));
  assert(receiverAddressHit(12,188) && !receiverAddressHit(228,188));
  assert(addressKey(20,110) == 1 && addressKey(165,190) == 9);
  assert(addressKey(20,230) == 10 && addressKey(90,230) == 0 && addressKey(165,230) == 11);
  assert(addressKey(80,110) == -1 && addressKey(20,136) == -1 && addressKey(20,280) == 12);
  assert(!usbIdleExpired(4999, 0) && usbIdleExpired(5000, 0));
  assert(!usbIdleExpired(100, 99));
  assert(usbIdleExpired(3999, UINT32_MAX - 1000));
  RetrySchedule retry;
  assert(retry.ready(0));
  retry.failed(100); assert(!retry.ready(2099) && retry.ready(2100));
  assert(retry.seconds(101) == 2);
  for (int i = 0; i < 20; ++i) retry.failed(100);
  assert(retry.wait == 30000 && !retry.ready(30099) && retry.ready(30100));
  retry.succeeded(200); assert(retry.wait == 0 && retry.failures == 0 && retry.ready(200));
  retry.reset(); assert(retry.ready(0));
  retry.failed(UINT32_MAX - 1000); assert(!retry.ready(998) && retry.ready(999));
  assert(receiverRetryHit(12,270) && !receiverRetryHit(114,270));
  assert(receiverSettingsHit(126,270) && !receiverSettingsHit(228,270));
  assert(reuseWifiPassword("Home", "Home", "", false));
  assert(!reuseWifiPassword("Home", "Other", "", false));
  assert(!reuseWifiPassword("Home", "Home", "replacement", false));
  assert(!reuseWifiPassword("Home", "Home", "", true));
  assert(!reuseWifiPassword("", "", "", false));
  assert(setupOriginAllowed("http://192.168.4.1"));
  assert(!setupOriginAllowed(nullptr) && !setupOriginAllowed("") && !setupOriginAllowed("http://evil.test"));
  UsbSession session; session.owned = true;
  assert(session.pause() && !session.pause()); // Ownership survives stale-image UI; only explicit setup releases it.
  Snake snake;
  snake.reset(0);
  assert(snake.length == 4 && snake.alive && !snake.contains(snake.food, snake.length));
  snake.step(0);
  const auto head = snake.cells[0];
  assert(!snake.turn(Left));
  assert(snake.turn(Up));
  assert(!snake.turn(Left)); // Cannot reverse by queuing two turns before a step.
  snake.step(0);
  assert(snake.cells[0] == head - Snake::Side && snake.direction == Up);
  snake.food = snake.cells[0] - Snake::Side;
  snake.step(42);
  assert(snake.length == 5 && !snake.contains(snake.food, snake.length));
  for (int i = 0; i < 30; ++i) snake.step(i);
  assert(!snake.alive && !snake.won);
  snake.reset(0);
  snake.length = 4; snake.cells[0] = 19; snake.cells[1] = 20; snake.cells[2] = 2; snake.cells[3] = 1;
  snake.direction = snake.pending = Up; snake.food = 100;
  snake.step(0); // Moving into a vacated tail is legal.
  assert(snake.alive && snake.cells[0] == 1);
  snake.reset(0);
  snake.cells[1] = snake.cells[0] + 1;
  snake.step(0);
  assert(!snake.alive);
  snake.reset(0);
  snake.length = Snake::Capacity - 1;
  snake.cells[0] = 0;
  for (uint16_t i = 1; i < snake.length; ++i) snake.cells[i] = i + 1;
  snake.food = 1;
  snake.step(0);
  assert(snake.length == Snake::Capacity && snake.won && !snake.alive);
  assert(sizeof(Snake) < 1024); // No framebuffer / PSRAM required.
  for (int i = 0; i < 4; ++i) {
    snake.reset(42); assert(snake.turn(Direction(i))); snake.step(0);
    assert(snake.alive && snake.direction == Direction(i));
  }

  Swipe swipe; Direction direction = Right;
  swipe.begin(100, 100);
  assert(!swipe.sample(110, 105, direction));
  assert(swipe.sample(100, 70, direction) && direction == Up);
  assert(!swipe.sample(150, 100, direction));
  for (int i = 0; i < 4; ++i) {
    swipe.begin(100, 100);
    const int x[] = {140, 100, 60, 100}, y[] = {100, 140, 100, 60};
    assert(swipe.sample(x[i], y[i], direction) && direction == Direction(i));
  }
  assert(networkHit(168, 0) && networkHit(239, 47));
  assert(!networkHit(167, 0) && !networkHit(240, 0) && !networkHit(200, 48));
  assert(touchTarget(180, 20, false, false) == TouchTarget::Remote);
  assert(networkHit(224, 0, true) && networkHit(239, 15, true));
  assert(!networkHit(223, 0, true) && !networkHit(240, 0, true) && !networkHit(239, 16, true));
  assert(touchTarget(239, 0, false, false) == TouchTarget::Network);
  assert(touchTarget(180, 20, true, false) == TouchTarget::Network);
  assert(touchTarget(180, 20, true, true) == TouchTarget::Network);
  assert(touchTarget(50, 150, true, false) == TouchTarget::Snake);
  assert(touchTarget(50, 150, true, true) == TouchTarget::Ignore);
  assert(touchTarget(50, 280, true, true) == TouchTarget::Play);
  assert(touchTarget(50, 150, false, false) == TouchTarget::Remote);
  assert(setupNavigationKey(12, 270) == 0 && setupNavigationKey(113, 313) == 0);
  assert(setupNavigationKey(126, 270) == 1 && setupNavigationKey(227, 313) == 1);
  assert(setupNavigationKey(120, 290) == 1 && setupNavigationKey(12, 269) == -1);
  assert(setupNavigationKey(228, 290) == 1 && setupNavigationKey(12, 314) == 0);
  assert(setupNavigationKey(0, 319) == 0 && setupNavigationKey(239, 319) == 1);
  assert(setupNavigationKey(240, 319) == -1 && setupNavigationKey(0, 320) == -1);
  assert(wizardTab(0, 0) == 0 && wizardTab(59, 43) == 0);
  assert(wizardTab(60, 0) == 1 && wizardTab(120, 0) == 2 && wizardTab(239, 43) == 3);
  assert(wizardTab(240, 0) == -1 && wizardTab(0, 44) == -1);
  assert(wizardTab(479, 87, 480, 640) == 3 && wizardTab(120, 0, 480, 640) == 1);
  assert(wizardTab(0, 88, 480, 640) == -1 && wizardTab(0, 0, 0, 320) == -1);
  WizardGesture gesture;
  gesture.begin(180, 150); assert(gesture.finish(80, 150) == 1);
  gesture.begin(80, 150); assert(gesture.finish(180, 150) == -1);
  gesture.begin(10, 150); assert(gesture.finish(10, 150) == -1);
  gesture.begin(230, 150); assert(gesture.finish(230, 150) == 1);
  gesture.begin(100, 10); assert(gesture.finish(10, 10) == 0);
  gesture.begin(100, 290); assert(gesture.finish(10, 290) == 0);
  gesture.begin(100, 100); assert(gesture.finish(100, 180) == 0);
  gesture.begin(47, 100); assert(gesture.finish(47, 100) == -1);
  gesture.begin(192, 100); assert(gesture.finish(192, 100) == 1);
  gesture.begin(48, 100); assert(gesture.finish(48, 100) == 0);
  gesture.begin(191, 100); assert(gesture.finish(191, 100) == 0);
  gesture.begin(10, 230); assert(gesture.finish(10, 230) == 0);
  assert(nextWizardPage(0) == 1 && nextWizardPage(1) == 2 && nextWizardPage(2) == 0);
  assert(checklistHit(0,224) && checklistHit(239,265));
  assert(!checklistHit(240,224) && !checklistHit(0,223) && !checklistHit(0,266));
  uint16_t rx = 16, ry = 44;
  assert(remotePoint(rx, ry) && rx == 0 && ry == 0);
  rx = 222; ry = 319;
  assert(remotePoint(rx, ry) && rx < 240 && ry < 320 && rx >= 238 && ry >= 318);
  rx = 223; ry = 50; assert(!remotePoint(rx, ry));
  rx = 16; ry = 43; assert(!remotePoint(rx, ry));
  DrawRate rate;
  rate.add(100, true);
  for (uint32_t t = 1100; t <= 5100; t += 1000) rate.add(t, true);
  assert(rate.measured && rate.tenths == 10);
  rate.add(5200, false); assert(!rate.measured && rate.tenths == 0);
  assert(strcmp(connectionLabel(false, false, false, false, false), "Offline") == 0);
  assert(strcmp(connectionLabel(false, true, false, false, false), "Setup") == 0);
  assert(strcmp(connectionLabel(false, true, true, false, false), "Connecting") == 0);
  assert(strcmp(connectionLabel(false, false, false, true, false), "Joined") == 0);
  assert(strcmp(connectionLabel(false, false, false, true, true), "Live") == 0);
  assert(strcmp(connectionLabel(true, false, false, false, true), "USB") == 0);
}
