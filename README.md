# COMfiltrat0r
COMfiltrat0r is a tool/technique developed by [cyllective](https://cyllective.com?comf=1) to bypass USB mass storage policies. You can read the full story and technical details in our blog post over at [cyllective.com](https://cyllective.com/blog/post/comfiltrat0r).

<div align="center">
	<img height="350px" src="static/comfiltrat0r.gif">
</div>

## How does this work?
If policies still allow for serial devices, you can send data over serial (RS-232) to a microcontroller using a web browser that supports [WebSerial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).

## Hardware Setup
Those steps should also be possible on different [microcontrollers that support MicroPython](https://micropython.org/download/).

### Teensy 4.1
+ Flash [MicroPython](https://micropython.org/download/TEENSY41/) onto your Teensy via the [Teensy Loader](https://www.pjrc.com/teensy/loader.html)
+ Copy `devices/teensy41/boot.py` and `devices/teensy/main.py` onto a microSD card (cheap knockoff cards can cause errors)
+ Plug the microSD card into the Teensy

### Pico
+ Flash [MicroPython](https://micropython.org/download/rp2-pico/) onto your Pico
	+ Copy the `uf2` file onto the file storage after connecting the Pico while holding `BOOTSEL`
+ Wire up an SPI to microSD card interface
```bash
# You can use any SPI pins. Those are just the ones from the example code
CS   <-> Pin 17
SCK  <-> Pin 19
MOSI <-> Pin 20
MISO <-> Pin 16
```
+ Plug in a microSD card (cheap knockoff cards can cause errors)
+ Set up [Thonny](https://thonny.org/) for the Pico and MicroPython
+ Copy `devices/pico/main.py` and `devices/pico/sdcard.py` to the Pico via Thonny's file browser

## Software Setup
You have multiple options:
- Visit [cyllective.github.io/COMfiltrat0r](https://cyllective.github.io/COMfiltrat0r) via a supported browser
- Open `index_combined.html` in a supported browser

## Known Problems
Depending on the client's operating system where the microcontroller gets plugged in, you may encounter that the device cannot be opened. This is the result of another program or even your OS taking control of the serial port. 

## Kudos
[p5.webserial.js](https://github.com/gohai/p5.webserial/blob/main/libraries/p5.webserial.js) from [gohai/p5.webserial](https://github.com/gohai/p5.webserial)
