/*
 *
 * main.js
 * for https://github.com/cyllective/COMfiltrat0r
 * by https://cyllective.com
 * 
*/

// HTML elements to be manipulated
var article = document.getElementById("article");
var connectButton = document.getElementById("connect-button");
var dropField = document.getElementById("drop-field");
var sliderField = document.getElementById("slider-field");
var sliderValue = document.getElementById("slider-value");
var slider = document.getElementById("slider");
// Variable to track the value of the chunk size slider
var chunkSize = 10000;
// Serial/COM object
var serial = null;

// Convert a arrayBuffer to hex
function arrayBufferToHex(buffer) {
    const byteArray = new Uint8Array(buffer);
    let hexString = '';

    for (let i = 0; i < byteArray.length; i++) {
        const hex = byteArray[i].toString(16).padStart(2, '0');
        hexString += hex;
    }

    return hexString;
}

// Will only return once a message from the serial port is received
async function waitForSerialAck() {
    while (true) {
        if (!(serial)) {
            // Port was closed in the meantime
            return false;
        }

        if (serial.available() > 0) {
            // There are bytes to read, read all
            let message = String(serial.read());
            if (message != "") {
                // Got something
                //console.log(`COM: ${message}`);
                return true;
            }
        }

        // Poll every 100 ms
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Open (connect) the port
async function openPort() {
    serial = new WebSerial;
    let ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
        // If there are paired ports, autoselect the first one and connect
        serial.open(ports[0], 115200);
    } else {
        // Will open the port select window
        serial.open(115200);
    }

    // Add delay to wait for serial.open
    await (async function () {
        return new Promise(resolve => setTimeout(resolve, 1500));
    }())

    // Check if the port was actually opened
    let isOpen = await (async function () {
        return serial.opened();
    }())
    // Return is the port is closed
    if (!(isOpen)) {
        return;
    }

    // Communication checks with the device
    await serial.write("cyllective r0cks\r\n").then(waitForSerialAck);

    // ready to transfer
    connectButton.textContent = "Disconnect";
    dropField.style.color = "white";
    sliderField.style.color = "white";

    // Drop field color on dragover
    dropField.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropField.style.backgroundColor = '#2a2a2a';
    });

    // Drop field uncolor on dragleave
    dropField.addEventListener('dragleave', function (e) {
        e.preventDefault();
        dropField.style.background = '';
    });

    // Drop Field on drop
    dropField.addEventListener('drop', function (e) {
        e.preventDefault();
        dropField.style.background = '';
        sendFile(e.dataTransfer.files[0]);
    });

    // Update the value when the slider changes
    slider.addEventListener("input", function () {
        sliderValue.textContent = slider.value;
        chunkSize = slider.value;
    });
}

// Disconnects from the port
async function closePort() {
    if (serial) {
        serial.close();
        serial = null;
    }

    connectButton.textContent = "Connect";
    dropField.style.color = "gray";
    sliderField.style.color = "gray";
}

// Loads & sends the file
async function sendFile(file) {
    const reader = new FileReader();

    // Once the file is read
    reader.onload = async (e) => {
        let dropFieldText = dropField.textContent;
        console.log(`${file.name} Start`);

        // Hex encode file
        let hexData = arrayBufferToHex(e.target.result);

        // Split into chunks
        let pattern = new RegExp(`.{1,${chunkSize}}`, 'g');
        let chunks = hexData.match(pattern);

        // Send each chunk
        let amount = chunks.length;
        for (let i = 0; i < amount; i++) {
            dropField.textContent = `Sending part ${i + 1}/${amount}`;
            // Format = filename;hex(chunk)\r\n
            await serial.write(String(file.name + ";" + chunks[i] + "\r\n")).then(waitForSerialAck);
        }
        dropField.textContent = dropFieldText;
        console.log(`${file.name} End`);
    }

    // Read the file
    reader.readAsArrayBuffer(file);
}

// Check for API support
if (!('serial' in navigator)) {
    // Not supported
    article.innerHTML = "<h2>Your browser does not support WebSerial</h2>";
} else {
    // Supported
    console.log("WebSerial is supported by your browser");
    connectButton.addEventListener('click', async (e) => {
        if (serial) {
            // User pressed on disconnect
            await closePort();
        } else {
            // User pressed on connect
            await openPort();
        }
    });
}
