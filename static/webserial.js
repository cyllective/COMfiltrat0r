/**
 * webserial.js
 * for https://github.com/cyllective/COMfiltrat0r
 * by https://cyllective.com
 * 
 * 
 * Based on 
 * p5.webserial
 * (c) Gottfried Haider 2021-2023
 * LGPL
 * https://github.com/gohai/p5.webserial
 * Based on documentation: https://web.dev/serial/
 */

'use strict';

// Can be called with ArrayBuffers or views on them
function memcpy(dst, dstOffset, src, srcOffset, len) {
    if (!(dst instanceof ArrayBuffer)) {
        dstOffset += dst.byteOffset;
        dst = dst.buffer;
    }
    if (!(src instanceof ArrayBuffer)) {
        srcOffset += src.byteOffset;
        src = src.buffer;
    }
    const dstView = new Uint8Array(dst, dstOffset, len);
    const srcView = new Uint8Array(src, srcOffset, len);
    dstView.set(srcView);
}

class WebSerial {
    constructor() {
        this.options = {
            baudRate: 9600
        }; // for port.open()
        this.port = null; // SerialPort object
        this.reader = null; // ReadableStream object
        this.keepReading = true; // set to false by close()
        this.inBuf = new ArrayBuffer(1024 * 1024); // 1M
        this.inLen = 0; // bytes in inBuf
        this.textEncoder = new TextEncoder(); // to convert to UTF-8
        this.textDecoder = new TextDecoder(); // to convert from UTF-8

        if (!('serial' in navigator)) {
            throw new Error('WebSerial is not supported in your browser (try Chrome or Edge)');
        }
    }

    /**
     * Returns the number of characters available for reading.
     * Note: use availableBytes() to get the number of bytes instead.
     * @method available
     * @return {Number} number of Unicode characters
     */
    available() {
        const view = new Uint8Array(this.inBuf, 0, this.inLen);

        // count the number of codepoint start bytes, excluding
        // incomplete trailing characters
        let characters = 0;
        for (let i = 0; i < view.length; i++) {
            const byte = view[i];
            if (byte >> 7 == 0b0) {
                characters++;
            } else if (byte >> 5 == 0b110 && i < view.length - 1) {
                characters++;
            } else if (byte >> 4 == 0b1110 && i < view.length - 2) {
                characters++;
            } else if (byte >> 3 == 0b11110 && i < view.length - 3) {
                characters++;
            }
        }
        return characters;
    }

    /**
     * Closes the serial port.
     * @method close
     */
    close() {
        if (this.reader) {
            this.keepReading = false;
            this.reader.cancel();
        } else {
            console.log('Serial port is already closed');
        }
    }

    /**
     * Opens a port based on arguments
     * e.g.
     * - open();
     * - open(57600);
     * - open('Arduino');
     * - open(usedSerialPorts()[0]);
     * - open('Arduino', 57600);
     * - open(usedSerialPorts()[0], 57600);
     */
    open() {
        (async () => {
            await this.selectPort(...arguments); // sets options and port
            await this.start(); // opens the port and starts the read-loop
        })();
    }

    /**
     * Returns whether the serial port is open and available for
     * reading and writing.
     * @method opened
     * @return {Boolean} true if the port is open, false if not
     */
    opened() {
        return(this.port instanceof SerialPort && this.port.readable !== null);
    }

    /**
     * Reads characters from the serial port and returns them as a string.
     * The data received over serial are expected to be UTF-8 encoded.
     * @method read
     * @param {Number} length number of characters to read (default: all available)
     * @return {String}
     */
    read(length = this.inLen) {
        if (!this.inLen || !length) {
            return '';
        }

        const view = new Uint8Array(this.inBuf, 0, this.inLen);

        // This consumes UTF-8, ignoring invalid byte sequences at the
        // beginning (we might have connected mid-sequence), and the
        // end (we might still missing bytes).

        // 0xxxxxxx
        // 110xxxxx 10xxxxxx
        // 1110xxxx 10xxxxxx 10xxxxxx
        // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx

        let bytesToConsume = 0;
        let startByteOffset = null;
        let byteLength = null;
        let charLength = 0;

        for (let i = 0; i < view.length; i++) {
            const byte = view[i];
            // console.log('Byte', byte);

            let codepointStart;
            if (byte >> 7 == 0b0) {
                codepointStart = true;
                bytesToConsume = 0;
                // console.log('ASCII character');
            } else if (byte >> 5 == 0b110) {
                codepointStart = true;
                bytesToConsume = 1;
                // console.log('Begin 2-byte codepoint');
            } else if (byte >> 4 == 0b1110) {
                codepointStart = true;
                bytesToConsume = 2;
                // console.log('Begin 3-byte codepoint');
            } else if (byte >> 3 == 0b11110) {
                codepointStart = true;
                bytesToConsume = 3;
                // console.log('Begin 4-byte codepoint');
            } else {
                codepointStart = false;
                bytesToConsume--;
                // console.log('Continuation codepoint');
            }

            if (startByteOffset === null && codepointStart) {
                startByteOffset = i;
                // console.log('String starts at', i);
            }
            if (startByteOffset !== null && bytesToConsume <= 0) {
                charLength++;
                byteLength = i - startByteOffset + 1;
                // console.log('Added character', charLength, 'characters', byteLength, 'bytes');
            }
            if (length <= charLength) { // console.log('Enough characters');
                break;
            }
        }

        if (startByteOffset !== null && byteLength !== null) {
            const out = new Uint8Array(this.inBuf, startByteOffset, byteLength);
            const str = this.textDecoder.decode(out);
            // console.log('String is', str);

            // shift input buffer
            if (startByteOffset + byteLength < this.inLen) {
                memcpy(this.inBuf, 0, this.inBuf, startByteOffset + byteLength, this.inLen - byteLength - startByteOffset);
            }
            this.inLen -= startByteOffset + byteLength;

            return str;
        } else {
            return '';
        }
    }

    /**
     * Sets this.port and this.options based on arguments passed
     * to the constructor.
     */
    async selectPort() {
        let filters = [];

        if (1 <= arguments.length) {
            if (Array.isArray(arguments[0])) { // for requestPort(), verbatim
                filters = arguments[0];
            } else if (arguments[0] instanceof SerialPort) { // use SerialPort as-is, skip requestPort()
                this.port = arguments[0];
                filters = null;
            } else if (typeof arguments[0] === 'object') { // single vid/pid-containing object
                filters = [arguments[0]];
            } else if (typeof arguments[0] === 'string') { // preset
                const preset = arguments[0];
                if (preset in this.presets) {
                    filters = this.presets[preset];
                } else {
                    throw new TypeError('Unrecognized preset "' + preset + '", available: ' + Object.keys(this.presets).join(', '));
                }
            } else if (typeof arguments[0] === 'number') {
                this.options.baudRate = arguments[0];
            } else {
                throw new TypeError('Unexpected first argument "' + arguments[0] + '"');
            }
        }

        if (2 <= arguments.length) {
            if (typeof arguments[1] === 'object') { // for port.open(), verbatim
                this.options = arguments[1];
            } else if (typeof arguments[1] === 'number') {
                this.options.baudRate = arguments[1];
            } else {
                throw new TypeError('Unexpected second argument "' + arguments[1] + '"');
            }
        }

        try {
            if (filters) {
                this.port = await navigator.serial.requestPort({filters: filters});
            } else { // nothing to do if we got passed a SerialPort instance
            }
        } catch (error) {
            console.warn(error.message);
            this.port = null;
        }
    }

    /**
     * Opens this.port and read from it indefinitely.
     */
    async start() {
        if (!this.port) {
            console.error('No serial port selected.');
            return;
        }

        try {
            await this.port.open(this.options);
            console.log('Connected to serial port');
            this.keepReading = true;
        } catch (error) {
            let msg = error.message;
            if (msg === 'Failed to open serial port.') {
                msg += ' (The port might already be open in another tab or program, e.g. the Arduino Serial Monitor.)';
            }
            console.error(msg);
            return;
        }

        while (this.port.readable && this.keepReading) {
            this.reader = this.port.readable.getReader();

            try {
                while (true) {
                    let {value, done} = await this.reader.read();

                    if (done) {
                        this.reader.releaseLock(); // allow the serial port to be closed later
                        break;
                    }

                    if (value) {
                        // take the most recent bytes if the newly-read buffer was
                        // to instantly overflow the input buffer (unlikely)
                        if (this.inBuf.byteLength < value.length) {
                            value = new Uint8Array(value.buffer, value.byteOffset + value.length - this.inBuf.byteLength, this.inBuf.byteLength);
                        }

                        // discard the oldest parts of the input buffer on overflow
                        if (this.inBuf.byteLength < this.inLen + value.length) {
                            memcpy(this.inBuf, 0, this.inBuf, this.inLen + value.length - this.inBuf.byteLength, this.inBuf.byteLength - value.length);
                            console.warn('Discarding the oldest ' + (
                                this.inLen + value.length - this.inBuf.byteLength
                            ) + ' bytes of serial input data (you might want to read more frequently or increase the buffer via bufferSize())');
                            this.inLen -= this.inLen + value.length - this.inBuf.byteLength;
                        }

                        // copy to the input buffer
                        memcpy(this.inBuf, this.inLen, value, 0, value.length);
                        this.inLen += value.length;
                    }
                }
            } catch (error) { // if a non-fatal (e.g. framing) error occurs, continue w/ new Reader
                this.reader.releaseLock();
                console.warn(error.message);
            }
        }

        this.port.close();
        this.reader = null;
        console.log('Disconnected from serial port');
    }

    /**
     * Writes data to the serial port.
     * Note: when passing a number or an array of numbers, those need to be integers
     * and between 0 to 255.
     * @method write
     * @param {String|Number|Array of number|ArrayBuffer|TypedArray|DataView} out data to send
     * @return {Boolean} true if the port was open, false if not
     */
    async write(out) {
        let buffer;

        // check argument
        if (typeof out === 'string') {
            buffer = this.textEncoder.encode(out);
        } else if (typeof out === 'number' && Number.isInteger(out)) {
            if (out < 0 || 255 < out) {
                throw new TypeError('Write expects a number between 0 and 255 for sending it as a byte. To send any number as a sequence of digits instead, first convert it to a string before passing it to write().');
            }
            buffer = new Uint8Array([out]);
        } else if (Array.isArray(out)) {
            for (let i = 0; i < out.length; i++) {
                if (typeof out[i] !== 'number' || !Number.isInteger(out[i]) || out[i] < 0 || 255 < out[i]) {
                    throw new TypeError('Array contained a value that wasn\'t an integer, or outside of 0 to 255');
                }
            }
            buffer = new Uint8Array(out);
        } else if (out instanceof ArrayBuffer || ArrayBuffer.isView(out)) {
            buffer = out;
        } else {
            throw new TypeError('Supported types are: String, Integer number (0 to 255), Array of integer numbers (0 to 255), ArrayBuffer, TypedArray or DataView');
        }

        if (!this.port || !this.port.writable) {
            console.warn('Serial port is not open, ignoring write');
            return false;
        }

        const writer = this.port.writable.getWriter();
        await writer.write(buffer);
        writer.releaseLock(); // allow the serial port to be closed later
        return true;
    }
}
