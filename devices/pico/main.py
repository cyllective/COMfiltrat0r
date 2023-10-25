"""
https://github.com/cyllective/COMfiltrat0r
by https://cyllective.com
"""

from machine import SPI, Pin
import sdcard, uos, ubinascii, time

# define the internal LED for signaling
internal_led = Pin(25, Pin.OUT)

# returns true if a file exists
def file_exists(filename: str):
    try:
        f = open(filename, "r")
    except OSError:
        return False
    return True

try:
    # set up SD card via SPI
    spi = SPI(1,sck=Pin(14), mosi=Pin(15), miso=Pin(12))
    cs = Pin(13)
    sd = sdcard.SDCard(spi, cs)
    uos.mount(sd, '/sd')
    # signal ready
    internal_led.on()
except Exception:
    while True:
        # signal SD card error by blinking LED endlessly
        internal_led.on()
        time.sleep_ms(250)
        internal_led.off()
        time.sleep_ms(250)

while True:
	# read from user input
	data = input()
	if ";" in data:
		# got data, signal LED
		internal_led.off()
		# split up data
		filename = data.split(";")[0]
		chunk_hex = data.split(";")[1]

		if file_exists(f"/sd/{filename}"):
			# file exists, so only append
			file = open(f"/sd/{filename}", "ab")
		else:
			# file does not exist
			file = open(f"/sd/{filename}", "wb")
		# hex to bytes
		chunk = ubinascii.unhexlify(chunk_hex)
		# write bytes to file & close
		file.write(chunk)
		file.close()
		# done
		internal_led.on()
		print(f"\rACK {filename};{len(chunk)}")
	else:
		print("COMfiltrat0r ready")
