"""
https://github.com/cyllective/COMfiltrat0r
by https://cyllective.com
"""

from machine import Pin
import uos, ubinascii

# define the internal LED for signaling
internal_led = Pin(13, Pin.OUT)

# returns true if a file exists
def file_exists(filename: str):
    try:
        f = open(filename, "r")
    except OSError:
        return False
    return True

while True:
    # read from user input
    data = input()
    if ";" in data:
        # got data, signal LED
        internal_led.off()
        # split up data
        filename = data.split(";")[0]
        chunk_hex = data.split(";")[1]

        if file_exists(filename):
            # file exists, so only append
            file = open(filename, "ab")
        else:
            # file does not exist
            file = open(filename, "wb")
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
