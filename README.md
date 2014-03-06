microADSB
=========

NodeJS interface to the microADSB-USB receiver (http://www.microadsb.com/)

Requirements
------------

* NodeJS
* serialport (from `npm`)
* A compatible ADS-B receiver

Installation
------------

Inside your `node_modules` directory:

    git clone https://www.github.com/jeffwalter/microADSB.git
    npm install

Example
-------

	var microADSB = require ('microADSB');

	var adsb = new microADSB ();
	adsb.device = '/dev/ttyUSB0';
	
	adsb.on ('open', function (err) {
		if (err) {
			console.error ('Error: ' + err);
			return;
		}
		console.log ('Notice: ADSB port opened');
	});

	adsb.on ('message', function (message) {
		console.log (message);
	});

	adsb.open ();

Output
------

### 52 bit squitter

	{
		frameid: 690,
		timestamp: {
			string: '0x001310942f70',
			integer: 81882525552
		},
		type: '*',
		downlinkformat: 4,
		data: [ 32, 0, 13, 177, 149, 135, 115 ],
		frame: '*20000DB1958773;'
	}


### 112 bit extended squitter (ADS-B)

	{
		frameid: 62904,
		timestamp: {
			string: '0x001310921fb8',
			integer: 81882390456
		},
		type: '*',
		downlinkformat: 17,
		data: [ 141, 171, 31, 254, 153, 148, 205, 134, 104, 76, 8, 88, 72, 160 ],
		frame: '*8DAB1FFE9994CD86684C085848A0;'
	}

API
---

### Properties

#### Serial Device
* `device` (string): Path to the serial device presented by the ADS-B receiver
* `baudrate` (integer, 115200): Baudrate to use. **NOTE:** *The microADSB-USB uses 115200bps and it can't be changed.*
* `databits` (integer, 8): Number of bits per "byte". **NOTE:** *The microADSB-USB uses 8 and it can't be changed.*
* `parity` (integer, 0): Which bits to use for parity. **NOTE:** *The microADSB-USB uses 0 and it can't be changed.*
	* 0 - No parity
	* 1 - Odd
	* 2 - Even
* `stopbits` (float, 1): Number of bits that indicate a stop. **NOTE:** *The microADSB-USB uses 1 and it can't be changed.*

#### ADS-B
* `frameids` (boolean, false): Ask the ADS-B receiver to tag incoming frames with an incrementing ID so you can tell if a frame is dropped.
* `timestamps` (boolean, false): As the ADS-B receiver to tag incoming frames with a timestamp. **NOTE:** *The timestamps are pretty useless and NodeJS doesn't support 48bit unsigned integers.* 
* `heartbeats` (boolean, false): Instruct the ADS-B receiver to send a heartbeat frame about every second.
* `raw` (boolean, false): Instruct the ADS-B receiver to deliver frames using a binary syntax to use less bandwidth. **NOTE:** *The binary protocol is not implemented in this module yet.*
* `mode` (integer, 2): Tell the ADS-B receiver which types of frames you'd like to receive:
	* 2 - All frames
	* 3 - Only DF17, DF18, and DF19 frames
	* 4 - Only DF17, DF18, and DF19 frames with valid CRC

### Methods

* `on`: Sets up a callback for an event. Callback definitions are detailed in the **Events** section below.
* `open`: Open the serial connection to the ADS-B receiver and configure it using the ADS-B properties. Calls the optional passed function or fires the `open` event when everything is ready or an error occurs.
    * Callback: `function (err)`
* `close`: Closes down the serial connection after attempting to reset the ADS-B receiver. Calls the optional passed function or fires the `close` event when everything is shut down or an error occurs.
    * Callback: `function (err)`

### Events

* `open`: Fires when the ADS-B receiver is opened, configured, and ready to send events, or an error occurred during opening.
    * Callback: `function (err)`
* `message`: Calls the passed function when a message arrives from the ADS-B receiver. Passes a structure containing the message and extra information when available.
    * Callback: `function (message)`
* `heartbeat`: When heartbeats are enabled prior to calling `open()` the callback for this event is called every time a heartbeat frame is received.
    * Callback: `function ()`
* `err`: A general error event. Any out of call error causes this event to fire.
    * Callback: `function (err)`
* `close`: When the ADS-B receiver goes away (intentional via `close()` or for some other reason) this event is called. Any error is passed along in the first argument.
    * Callback: `function (err)`
