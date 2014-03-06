var serialPort = require ('serialport');
var SerialPort = serialPort.SerialPort;
var hexy = require ('hexy').hexy;

module.exports = microADSB;

function microADSB () {
	this.__CALLBACKS = {
		'open': null,
		'message': null,
		'heartbeat': null,
		'err': null,
		'close': null
	};
	this.__SERIAL = null;
	this.__BUFFER = '';

	this.online = false;
	this.firmware = null;

	this.device = null;
	this.baudrate = 115200;
	this.databits = 8;
	this.parity = 0;
	this.stopbits = 1;

	this.frameids = false;
	this.timestamps = false;
	this.heartbeats = false;
	this.raw = false;
	this.mode = 2;
}

microADSB.prototype.on = function (event, callback) {
	if (this.__CALLBACKS [event] === undefined) {
		return (callback (new Error ('Undefined callback "' + event + '"')));
	}
	this.__CALLBACKS [event] = callback;
	return (this);
};

microADSB.prototype.close = function (callback) {
	if (this.__SERIAL) {
		this.__SERIAL.close (function (err) {
			// Destroy the serial object
			this.__SERIAL = null;
			// Reset the buffer
			this.__BUFFER = '';
			// Set us offline
			this.online = false;
			// Reset the firmware
			this.firmware = null;

			if (callback) {
				// Use the passed callback
				return (callback (err));

			} else if (this.__CALLBACKS.close) {
				// Use the stored callback
				return (this.__CALLBACKS.close (err));
			}
		});
	}
};

microADSB.prototype.open = function (callback) {
	try {
		this.__SERIAL = new SerialPort (
			this.device,
			{
				'baudRate': this.baudrate,
				'dataBits': this.databits,
				'stopBits': this.stopbits,
				'parity': this.parity
			},
			false
		);

	} catch (err) {
		// Destroy the serial object
		this.__SERIAL = null;
		// Reset the buffer
		this.__BUFFER = '';
		// Set us offline
		this.online = false;
		// Reset the firmware
		this.firmware = null;

		if (callback) {
			// Use the passed callback
			return (callback (err));

		} else if (this.__CALLBACKS.open) {
			// Use the stored callback
			return (this.__CALLBACKS.open (err));

		} else {
			// No callback, print to STDERR and be done
			console.error ('ERROR: microADSB: ' . err);
			return (null);
		}
	}

	// Cute hack for referencing this inside of __SERIAL.on
	var parent = this;

	this.__SERIAL.on ('open', function (err) {
		// Check for an error
		if (err) {
			// Destroy the serial object
			parent.__SERIAL = null;
			// Reset the buffer
			parent.__BUFFER = '';
			// Set us offline
			parent.online = false;
			// Reset the firmware
			parent.firmware = null;

			if (callback) {
				// Use the passed callback
				return (callback (err));

			} else if (parent.__CALLBACKS.open) {
				// Use the stored callback
				return (parent.__CALLBACKS.open (err));

			} else {
				// No callback, print to STDERR and be done
				console.error ('ERROR: microADSB: ' . err);
				return (null);
			}
		}

		// Setup internal callbacks for serial
		parent.__SERIAL.on ('data', function (data) {
			var result;

			parent.__BUFFER += data;

			for (;;) {
				parent.__BUFFER = parent.__BUFFER.replace (/^(\r\n|\n\r?|\n)+/, '');

				if ((matches = parent.__BUFFER.match (/^(\x1a(?:\x32.{14}|\x33.{21}))/)) !== null) {
					// Binary message
					// Remove message from buffer
					parent.__BUFFER = parent.__BUFFER.substr (matches [1].length);
					// Convert raw to standard notation
					if ((result = microADSBRawToObject (matches [1])) !== null) {
						if (parent.__CALLBACKS.message) {
							parent.__CALLBACKS.message (result);
						}
					}

				} else if ((matches = parent.__BUFFER.match (/^([^\r\n]*)(\r\n?|\n\r?)/)) !== null) {
					// ASCII message
					// Remove message from buffer
					parent.__BUFFER = parent.__BUFFER.substr (matches [1].length + matches [2].length);
					// Convert ASCII to standard notation
					if ((result = microADSBASCIIToObject (matches [1])) !== null) {
						// Got an object!
						if (result.type == '#') {
							// Treat command responses special
							if (result.data [0] === 0x00) {
								// Firmware version
								parent.firmware = result.data [2];

								// Send our mode command
								parent.__SERIAL.write (microADSBCommandFormat ([0x43, microADSBMode (parent.raw, parent.heartbeats, parent.frameids, parent.timestamps, parent.mode)]), function (err, results) {
									if (err) {
										// Close the serial object
										parent.__SERIAL.close (function (error) {
											// Destroy the serial object
											parent.__SERIAL = null;
											// Reset the buffer
											parent.__BUFFER = '';
											// Set us offline
											parent.online = false;
											// Reset the firmware
											parent.firmware = null;

											if (callback) {
												// Use the passed callback
												return (callback (err));

											} else if (parent.__CALLBACKS.open) {
												// Use the stored callback
												return (parent.__CALLBACKS.open (err));

											} else {
												// No callback, print to STDERR and be done
												console.error ('ERROR: microADSB: ' . err);
												return (null);
											}
										});
									}
								});

							} else if (result.data [0] == 0x43) {
								// Mode response
								if (result.data [1] == microADSBMode (parent.raw, parent.heartbeats, parent.frameids, parent.timestamps, parent.mode)) {
									// Success
									parent.online = true;

									if (callback) {
										// Use the passed callback
										return (callback (null));

									} else if (parent.__CALLBACKS.open) {
										// Use the stored callback
										return (parent.__CALLBACKS.open (null));
									}

								} else {
									// Failure
									parent.__SERIAL.close (function (err) {
										// Destroy the serial object
										parent.__SERIAL = null;
										// Reset the buffer
										parent.__BUFFER = '';
										// Set us offline
										parent.online = false;
										// Reset the firmware
										parent.firmware = null;

										err = new Error ('Failed to set ADS-B mode');
										if (callback) {
											// Use the passed callback
											return (callback (err));

										} else if (parent.__CALLBACKS.open) {
											// Use the stored callback
											return (parent.__CALLBACKS.open (err));

										} else {
											// No callback, print to STDERR and be done
											console.error ('ERROR: microADSB: ' . err);
											return (null);
										}
									});
								}
							}

						} else if (parent.__CALLBACKS.message) {
							if (result.downlinkformat == 23) {
								if (parent.__CALLBACKS.heartbeat) {
									parent.__CALLBACKS.heartbeat ();
								}

							} else if (parent.__CALLBACKS.message) {
								parent.__CALLBACKS.message (result);
							}
						}
					}

				} else {
					break;
				}
			}
		});

		parent.__SERIAL.on ('err', function (err) {
			if (parent.__CALLBACKS.err) {
				// Use the stored callback
				return (parent.__CALLBACKS.err (err));
			}
		});

		parent.__SERIAL.on ('close', function () {
			// Destroy the serial object
			parent.__SERIAL = null;
			// Reset the buffer
			parent.__BUFFER = '';
			// Set us offline
			parent.online = false;
			// Reset the firmware
			parent.firmware = null;

			if (parent.__CALLBACKS.close) {
				// Use the stored callback
				return (parent.__CALLBACKS.close ());
			}
		});

		// Send a firmware query to start things off
		parent.__SERIAL.write (microADSBCommandFormat ([0x00]), function (err, results) {
			if (err) {
				// Close the serial object
				parent.__SERIAL.close (function (error) {
					// Destroy the serial object
					parent.__SERIAL = null;
					// Reset the buffer
					parent.__BUFFER = '';
					// Set us offline
					parent.online = false;
					// Reset the firmware
					parent.firmware = null;

					if (callback) {
						// Use the passed callback
						return (callback (err));

					} else if (parent.__CALLBACKS.open) {
						// Use the stored callback
						return (parent.__CALLBACKS.open (err));

					} else {
						// No callback, print to STDERR and be done
						console.error ('ERROR: microADSB: ' . err);
						return (null);
					}
				});
			}
		});
	});

	this.__SERIAL.open ();

	return (this);
};

function microADSBMode (raw, heartbeats, frameNumbers, timestamps, mode) {
	var result = 0x00;

	if (raw) {
		result |= 0x80;
	}
	if (heartbeats) {
		result |= 0x40;
	}
	if (frameNumbers) {
		result |= 0x20;
	}
	if (timestamps) {
		result |= 0x10;
	}
	if (mode && (mode >= 2) && (mode <= 4)) {
		result |= mode & 0x0f;
	}

	return (result);
}

function microADSBCommandFormat (command) {
	var index, data = '';

	if (typeof (command) == 'string') {
		for (index = 0; index < command.length; index++) {
			data += ('00' + command.charCodeAt (index).toString (16).toUpperCase ()).substr (-2) + '-';
		}
		data = data.substr (0, data.length - 1);

	} else {
		for (index = 0; index < command.length; index++) {
			data += ('00' + command [index].toString (16).toUpperCase ()).substr (-2) + '-';
		}
		data = data.substr (0, data.length - 1);
	}

	return ('#' + data + "\r");
}

function microADSBRawToObject (data) {
	var result = {
		'frameid': null,
		'timestamp': null,
		'type': null,
		'data': null
	};

	return (null);
}

function microADSBASCIIToObject (data) {
	var result = {
		'frameid': null,
		'timestamp': {'string': null, 'integer': null},
		'type': null,
		'downlinkformat': null,
		'data': [],
		'frame': null
	};
	var index;

	// Store the type (#, *, or @)
	result.type = data.substr (0, 1);
	data = data.substr (1);

	// Check for frame numbers
	if ((matches = data.match (/;#([0-9a-f]+);/i)) !== null) {
		result.frameid = parseInt (matches [1], 16);
		data = data.replace (/;#([0-9a-f]+);/i, ';');
	}

	// Remove anything not a hex character
	result.frame = data.replace (/[^0-9a-f]/ig, '');

	// Even length?
	if (result.frame.length % 2 !== 0) {
		return (null);
	}

	// Move the data
	for (index = 0; index < result.frame.length; index += 2) {
		result.data [index / 2] = parseInt (result.frame.substr (index, 2), 16);
	}

	// Parse out any timestamp
	if (result.type == '@') {
		// 32bit integer overflow here
		result.timestamp.string = '0x';
		result.timestamp.string += ('00' + result.data [0].toString (16)).substr (-2);
		result.timestamp.string += ('00' + result.data [1].toString (16)).substr (-2);
		result.timestamp.string += ('00' + result.data [2].toString (16)).substr (-2);
		result.timestamp.string += ('00' + result.data [3].toString (16)).substr (-2);
		result.timestamp.string += ('00' + result.data [4].toString (16)).substr (-2);
		result.timestamp.string += ('00' + result.data [5].toString (16)).substr (-2);
		result.timestamp.integer = parseInt (result.timestamp.string, 16);
		result.data.splice (0, 6);
		result.frame = result.frame.substr (12);

		result.type = '*';
	}

	// Store the frame in a format that most people understand
	result.frame = result.type + result.frame;

	// Save out the downlink format
	result.downlinkformat = (result.data [0] & 0xf8) >> 3;

	return (result);
}
