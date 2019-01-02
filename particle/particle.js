/*
  https://github.com/chuank/node-red-contrib-particle
*/

module.exports = function (RED) {
	"use strict";
	var Particle = require("particle-api-js");

	// ******************************************
	// Configuration module - handles credentials
	// ******************************************
	function ParticleCloudNode(n) {
		var that = this;

		RED.nodes.createNode(this, n);

		this.host = n.host;
		this.port = n.port;
		this.name = n.name;

		// create one particle-api-js instance per cloud connection
		this.particleJS = new Particle();
		// this.particleJS.debug = true;
		if (this.host != "https://api.particle.io") {
			this.particleJS.baseUrl = this.host + ":" + this.port;
		}

		// the login approach here is to rely on a pre-defined access token that you can retrieve
		// from your own Particle.io account since most JS API calls rely on a valid authentication
		// token. Login mechanism (authentication, MFA) is not supported.

		this.on('close', function (removed, done) {
			if (removed) {
				that.trace("ParticleCloudNode config node removed");
			} else {
				that.trace("ParticleCloudNode config node restarted");
			}
			done();
		});
	}
	// register the existence of the Particle Cloud credentials configuration node
	RED.nodes.registerType("particle-cloud", ParticleCloudNode, {
		credentials: {
			accesstoken: { type: "password" }
		}
	});

	// **********************************************************************************
	// ParticleUtility node - for calling basic utility functions via the Particle JS API
	// **********************************************************************************
	function ParticleUtility(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleSSE nodes

		var that = this;

		RED.nodes.createNode(this, n);

		// Get all properties from node instance settings
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.utilitytype = n.utilitytype;
		this.devid = n.devid;
		this.productIdOrSlug = n.productIdOrSlug;
		this.timeoutDelay = 5; // ms

		// keep track of updated state (for updating status icons)
		this.propChanged = false;

		(this.pcloud.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if (!this.pcloud.credentials.accesstoken) {
			this.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		// Called when there's input from upstream node(s)
		this.on("input", function (msg) {
			// Retrieve all parameters from Message
			let val = msg;
			let validOp = false;

			let options = {
				auth: that.pcloud.credentials.accesstoken
			};

			// ignore if incoming message is invalid; otherwise store incoming message as new event name
			if (val) {
				if (val.topic === "devid") {
					if (!val.payload) {
						// ignore bad incoming payload
						that.warn("Ignored invalid new devid");
					} else {
						that.devid = val.payload;
						that.propChanged = true;
						that.trace("new devID: " + that.devid);
					}

				} else if (val.topic === "productIdOrSlug") {
					if (!val.payload) {
						// ignore bad incoming payload
						that.warn("Ignored invalid new productIdOrSlug");
					} else {
						that.productIdOrSlug = val.payload;
						that.propChanged = true;
						that.trace("new productIdOrSlug: " + that.productIdOrSlug);
					}
				}

				that.trace("Calling utility: " + that.utilitytype);
				switch (that.utilitytype) {
					case "listDevices":
						validOp = true;
						break;
					case "getDevice":
					case "signalDevice":
						that.trace("\tDevice ID: " + that.devid);
						options.signal = (val.payload == true);		// convert payload into true/false (loose conversion)
						options.deviceId = that.devid;
						validOp = true;
						break;
					default:
						validOp = false;
				}
			}

			if (validOp) {
				if (that.productIdOrSlug) {
					options.product = that.productIdOrSlug;
					that.trace("\tProductID: " + that.productIdOrSlug);
				}

				var utilPr;
				switch (that.utilitytype) {
					case "listDevices":
						utilPr = that.pcloud.particleJS.listDevices(options);
						break;
					case "getDevice":
						utilPr = that.pcloud.particleJS.getDevice(options);
						break;
					case "signalDevice":
						utilPr = that.pcloud.particleJS.signalDevice(options);
						break;
				}

				utilPr.then(
					function (data) {
						if (data.statusCode == 200) {
							that.trace("Utility call successful");
							let msg = {
								payload: data.body,
								statusCode: data.statusCode
							};
							that.send(msg);
						}
					},
					function (err) {
						that.error(err);
					}
				).catch(function () {
					that.error("Promise Rejected");
				});

			} else {
				that.error("Invalid utility type");
			}
		});

		this.on("close", function () {
			// close
		});
	}
	// register ParticleUtility node
	RED.nodes.registerType("particle-util", ParticleUtility);
	// end ParticleUtility



	// *********************************************************************
	// ParticleSSE node - base module for subscribing to Particle Cloud SSEs
	// *********************************************************************
	function ParticleSSE(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleSSE nodes

		var that = this;

		RED.nodes.createNode(this, n);

		// Get all properties from node instance settings
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.subscribetype = n.subscribetype;
		this.devprodslug = n.devprodslug;
		this.evtname = n.evtname;
		this.strict = n.strict;
		this.timeoutDelay = 5; // ms

		// keep track of updated state (for updating status icons)
		this.propChanged = false;

		(this.pcloud.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if (!this.pcloud.credentials.accesstoken) {
			this.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		setTimeout(function () {
			that.emit("initSSE", {});
		}, this.timeoutDelay);

		// Called when there's input from upstream node(s)
		this.on("input", function (msg) {
			// Retrieve all parameters from Message
			let validOp = false;
			let val = msg;

			// ignore if incoming message is invalid; otherwise store incoming message as new event name
			if (!val) {
				if (val.topic === "evtname") {
					that.evtname = val.payload;
					that.propChanged = true;
					that.trace("new eventname: " + that.evtname);
					validOp = true;
				} else if (val.topic === "devid") {
					that.devprodslug = val.payload;
					that.propChanged = true;
					that.trace("new devID: " + ((that.devprodslug === "") ? "(noDevID/firehose)" : that.devprodslug));
					validOp = true;
				} else if (val.topic === "strict") {
					that.strict = val.payload;
					that.trace("strict flag changed: " + that.strict);
					validOp = true;
				} else if (val.topic === "productIdOrSlug") {
					if (!val.payload) {
						// ignore bad incoming payload
						that.warn("Ignored invalid new productIdOrSlug");
					} else {
						that.productIdOrSlug = val.payload;
						that.propChanged = true;
						that.trace("new productIdOrSlug: " + that.productIdOrSlug);
						validOp = true;
					}
				} else if (val.topic === "orgSlug") {
					if (!val.payload) {
						// ignore bad incoming payload
						that.warn("Ignored invalid new orgSlug");
					} else {
						that.orgSlug = val.payload;
						that.propChanged = true;
						that.trace("new orgSlug: " + that.orgSlug);
						validOp = true;
					}
				}
			}

			if (validOp) {
				// show 'reconnecting status' while the new parameters are setup
				that.status({
					fill: "yellow",
					shape: "dot",
					text: "Reconnecting..."
				});

				// only reconnect if we have a valid update
				setTimeout(function () {
					that.emit("initSSE", {});
				}, that.timeoutDelay);
			}
		});

		// SSE (Server-Sent-Event) Subscription
		this.on("initSSE", function () {
			// sanity check: close any pre-existing, open connections
			if (that.stream) {
				that.trace("### initSSE aborting pre-existing ES");
				that.stream.abort();
			}

			that.status({
				fill: "yellow",
				shape: "dot",
				text: "Connecting..."
			});
			that.trace("Connecting...");

			// if we're dealing with a local cloud, or if device ID is empty, fallback to public/event firehose & ignore device ID

			// setup options depending on node settings
			let options = {
				auth: that.pcloud.credentials.accesstoken
			};

			if (that.evtname) {
				options.name = encodeURIComponent(that.evtname);
			}

			let dps = encodeURIComponent(that.devprodslug);

			switch (that.subscribetype) {
				case "devid":
					options.deviceId = dps;
					break;
				case "mine":
					options.deviceId = "mine";
					break;
				case "all":
					break;
				case "productIdOrSlug":
					options.product = dps;
					break;
				case "orgSlug":
					options.org = dps;
					break;
			}

			that.pcloud.particleJS.getEventStream(options)
				.then(function (stream) {
					// store reference to EventStream object returned by the Promise
					that.stream = stream;

					that.status({
						fill: "green",
						shape: that.propChanged ? "ring" : "dot",
						text: that.propChanged ? "Property UPDATED OK" : "Connected"
					});
					that.trace("Connected");

					stream.on('event', function (data) {
						let msg = { payload: data };

						// BREAKING CHANGE: now passes the returned result from Particle as a JSON object as msg.payload
						if (!that.strict) {
							that.trace(JSON.stringify(data));
							that.send(msg);
						} else {
							if (data.name === that.evtname) {
								that.trace(JSON.stringify(data));
								that.send(msg);
							}
						}
					});
				}, function (error) {
					that.status({
						fill: "red",
						shape: "ring",
						text: "Error - refer to debug/log"
					});
					that.error(error);
				}).catch(function () {
					that.error("Promise Rejected");
				});
		});

		this.on("close", function () {
			that.status({
				fill: "grey",
				shape: "dot",
				text: "Closed"
			});
			that.trace("Closed");

			// close any pre-existing, open connections
			if (that.stream) {
				that.trace("GC EventStream");
				that.stream.abort();
			}
		});

	}
	// register ParticleSSE node
	RED.nodes.registerType("particle-SSE", ParticleSSE);
	// end ParticleSSE


	// **************************************************************************
	// ParticlePublish node - base module for submitting events to Particle Cloud
	// **************************************************************************
	function ParticlePublish(n) {
		// note:
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticlePublish nodes

		var that = this;

		RED.nodes.createNode(this, n);

		// Get all properties from node instance settings
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.evtname = n.evtname; // name of Particle Event to publish
		this.param = n.param; // string data to send as part of published Particle Event
		this.productIdOrSlug = n.productIdOrSlug;
		this.private = n.private;
		this.evtnametopic = n.evtnametopic;
		if (!n.ttl) {
			this.ttl = 60;
		} else {
			this.ttl = n.ttl;
		}
		this.repeat = Number(n.repeat) * 1000;
		this.interval_id = null;
		this.once = n.once;
		this.timeoutDelay = 5; // ms

		// keep track of updated state (for updating status icons)
		this.propChanged = false;

		(this.pcloud.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if (!this.pcloud.credentials.accesstoken) {
			this.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		if (this.once) { // run on init, if requested
			setTimeout(function () {
				that.emit("callPublish", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function (msg) {
			// Retrieve all parameters from Message
			let validOp = false;
			let repeatChanged = false;
			let val = msg;
			let execPub = false;

			// ignore if incoming message is invalid
			if (val) {
				if (val.topic === "evtname") {			// set new Event name; does not trigger publish Event
					that.evtname = val.payload;
					that.propChanged = true;
					that.trace("New published Event name: " + that.evtname);
					validOp = true;
				} else if (val.topic === "param") {		// new param (string data); trigger publish Event AND send param
					val.payload = JSON.stringify(val.payload).substring(0, 63);	// stringify and limit to 63 chars
					that.trace("New param: " + val.payload);
					validOp = execPub = true;
				} else if (that.evtnametopic && val.topic.length > 0) {
					// alternative usage mode: if user has selected the "Send Event Name, Data as msg.topic/msg.payload" option
					that.evtname = val.topic;
					that.param = val.payload;
					that.trace("evtnametopic publish Event: " + that.evtname + " : " + that.param);
					validOp = execPub = true;
				} else if (val.topic === "private") {	// new private flag
					if (val.payload) {
						that.private = true;
					} else {
						that.private = false;
					}
				} else if (val.topic === "ttl") {	// new publish event TTL
					that.ttl = Math.min(16777216, Math.max(0, Number(val.payload)));		// clamp within allowed range
					that.trace("New TTL (s): " + that.repeat);
					validOp = true;
				} else if (val.topic === "repeat") {	// new repeat interval; updates interval timer (which in turn will trigger publish Event)
					val.payload = Number(val.payload) * 1000;
					that.repeat = val.payload;
					that.trace("New repeat (ms): " + that.repeat);
					validOp = repeatChanged = true;
				} else if (!val.topic && val.payload) {
					// an incoming message with ANY msg.payload and NO msg.topic is considered a 'shortcut' call.
					validOp = execPub = true;
					that.trace("shortcut publish Event: " + that.evtname);
				}
			}

			if (validOp) {
				// signal to user that incoming messages have modified node settings
				if (execPub) {
					that.status({
						fill: "blue",
						shape: "dot",
						text: that.evtname + ":" + that.param + " SENT"
					});
				} else {
					that.status({
						fill: "green",
						shape: "ring",
						text: val.topic + " changed to " + val.payload
					});
				}

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(that.interval_id);
					that.interval_id = null;

					setTimeout(function () {
						that.emit("processPublish", {});
					}, that.timeoutDelay);
				}
			}

			if (execPub) {
				if (!that.evtname) { // Catch blank event name; worst-case situation
					that.warn("No Event name defined, reverting to \"NodeRED\"");
					that.evtname = "NodeRED";
				}

				if (val && val.payload && val.payload.length > 0) {
					that.param = val.payload;
				}

				setTimeout(function () {
					that.emit("processPublish", {});
				}, that.timeoutDelay);
			}
		});

		// Perform operations based on the method parameter.
		this.on("processPublish", function () {
			// Check for repeat and start timer
			if (that.repeat && !isNaN(that.repeat) && that.repeat > 0) {
				that.trace("Setting new repeat rate (ms):", that.repeat);

				that.interval_id = setInterval(function () {
					that.emit("callPublish", {});
				}, that.repeat);
			}
			// There is no repeat, just start once
			else if (that.evtname && that.evtname.length > 0) {
				that.trace("Event published");

				setTimeout(function () {
					that.emit("callPublish", {});
				}, that.timeoutDelay);
			}
		});

		// Execute actual Publish Event call
		this.on("callPublish", function () {
			let options = {
				name: that.evtname,
				data: that.param,
				isPrivate: that.private,
				auth: that.pcloud.credentials.accesstoken
			};

			if (that.productIdOrSlug) options.product = that.productIdOrSlug;

			var publishEventPr = that.pcloud.particleJS.publishEvent(options);

			publishEventPr.then(
				function (data) {
					if (data.statusCode === 200) {
						that.trace("Event published successfully");
						let msg = { payload: true };
						that.send(msg);
					}
				},
				function (err) {
					that.error("Failed to publish event: " + err);
				}
			).catch(function () {
				that.error("Promise Rejected");
			});

			that.trace("Publishing event: " + JSON.stringify(options));
		});

		this.on("close", function () {
			if (that.interval_id) {
				that.trace("Repeat interval closed.");
				clearInterval(that.interval_id);
			}
		});
	}
	// register ParticlePublish node
	RED.nodes.registerType("particle-pub", ParticlePublish);
	// end ParticlePublish


	// ***************************************************************************
	// ParticleFunc node - base module for calling Particle device cloud functions
	// ***************************************************************************
	function ParticleFunc(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleFunc nodes

		var that = this;

		RED.nodes.createNode(this, n);

		// Get all properties
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.devid = n.devid;
		this.fname = n.fname;
		this.param = n.param;
		this.productIdOrSlug = n.productIdOrSlug;
		this.repeat = n.repeat * 1000;
		this.interval_id = null;
		this.once = n.once;
		this.timeoutDelay = 5; //ms

		(this.pcloud.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if (!this.pcloud.credentials.accesstoken) {
			this.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		// Check device id
		if (!this.devid) {
			this.status({
				fill: "yellow",
				shape: "dot",
				text: "No Device ID"
			});
			this.error("No Particle Device ID set");
		} else {
			this.status({});
		}

		if (this.once) { // run on init, if requested
			setTimeout(function () {
				that.emit("processFunc", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function (msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;
			var execFunc = false;

			// ignore if incoming message is invalid
			if (val) {
				if (val.topic === "devid") {
					that.devid = val.payload;
					that.trace("new devid: " + that.devid);
					validOp = true;
				} else if (val.topic === "fname") {
					that.fname = val.payload;
					that.trace("new funcName: " + that.fname);
					validOp = true;
				} else if (val.topic === "param") {
					that.param = val.payload;
					that.trace("new param: " + that.param);
					validOp = execFunc = true;
				} else if (val.topic === "repeat") {
					that.repeat = Number(val.payload) * 1000;
					that.trace("new repeat (ms): " + that.repeat);
					validOp = repeatChanged = true;
				} else if (!val.topic && val.payload) { // 'shortcut' mode - easier way to call the function without specifying "param" as topic
					that.param = val.payload;
					validOp = execFunc = true;
					that.trace("shortcut func call: " + that.param);
				}
			}

			if (validOp) {
				// signal to user that incoming messages have modified node settings
				if (execFunc) {
					that.status({
						fill: "blue",
						shape: "dot",
						text: val.payload
					});
				} else {
					that.status({
						fill: "green",
						shape: "ring",
						text: val.topic + " changed to " + val.payload
					});
				}

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(that.interval_id);
					that.interval_id = null;

					setTimeout(function () {
						that.emit("processFunc", {});
					}, that.timeoutDelay);
				}
			}

			if (execFunc) {
				val = msg.payload;
				// Retrieve payload as param
				if (val && val.length > 0) {
					that.param = val;
				}

				setTimeout(function () {
					that.emit("processFunc", {});
				}, that.timeoutDelay);
			}

		});

		// Call Particle Function
		this.on("processFunc", function () {
			// Check for repeat and start timer
			if (that.repeat && !isNaN(that.repeat) && that.repeat > 0) {
				that.trace("new repeat (ms):", that.repeat);

				that.interval_id = setInterval(function () {
					that.emit("callFunc", {});
				}, that.repeat);

			}
			// There is no repeat, just start once
			else if (that.fname && that.fname.length > 0) {
				setTimeout(function () {
					that.emit("callFunc", {});
				}, that.timeoutDelay);
			}
		});

		// Execute actual Particle Device function call
		this.on("callFunc", function () {
			let options = {
				auth: that.pcloud.credentials.accesstoken,
				deviceId: that.devid,
				name: that.fname,
				argument: that.param
			};

			if (that.productIdOrSlug) options.product = that.productIdOrSlug;

			that.trace("Calling function...");
			that.trace("\t\tDevice ID: " + that.devid);
			that.trace("\t\tFunction Name: " + that.fname);
			that.trace("\t\tParameter(s): " + that.param);

			var fnPr = that.pcloud.particleJS.callFunction(options);
			fnPr.then(
				function (data) {
					if (data.statusCode == 200) {
						that.trace("Function published successfully");
						let msg = {
							raw: data.body,
							payload: data.body.return_value,
							id: data.body.id
						};
						that.send(msg);
					}
				},
				function (err) {
					that.error(err);
				}
			).catch(function () {
				that.error("Promise Rejected");
			});
		});

		this.on("close", function () {
			if (that.interval_id) {
				that.trace("Interval closed.");
				clearInterval(that.interval_id);
			}
		});
	}
	// register ParticleFunc node
	RED.nodes.registerType("particle-func", ParticleFunc);
	// end ParticleFunc


	// ***********************************************************************
	// ParticleVar node - base module for retrieving Particle device variables
	// ***********************************************************************
	function ParticleVar(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleVar nodes

		var that = this;

		RED.nodes.createNode(this, n);

		// Get all properties
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.devid = n.devid;
		this.getvar = n.getvar;
		this.productIdOrSlug = n.productIdOrSlug;
		this.repeat = n.repeat * 1000;
		this.interval_id = null;
		this.once = n.once;
		this.timeoutDelay = 5;

		(this.pcloud.host === "https://api.particle.io") ? this.isLocal = false : this.isLocal = true;

		if (!this.pcloud.credentials.accesstoken) {
			this.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		// Check device id
		if (!this.devid) {
			this.status({
				fill: "yellow",
				shape: "dot",
				text: ""
			});
			this.error("No Particle Device ID set");
		} else {
			this.status({});
		}

		if (this.once) { // run on init, if requested
			setTimeout(function () {
				this.emit("processVar", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function (msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;

			// ignore if incoming message is invalid
			if (val) {
				if (val.topic === "devid") {
					that.devid = val.payload;
					that.trace("new devid: " + that.devid);
					validOp = true;
				} else if (val.topic === "getvar") {
					that.getvar = val.payload;
					that.trace("new varName: " + that.getvar);
					validOp = true;
				} else if (val.topic === "repeat") {
					val.payload = Number(val.payload) * 1000;
					that.repeat = val.payload;
					that.trace("new repeat (ms): " + that.repeat);
					validOp = repeatChanged = true;
				}
			}

			if (validOp) {
				// here we signal that incoming messages have modified node settings
				that.status({
					fill: "green",
					shape: "ring",
					text: val.topic + " modified to " + val.payload
				});

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(that.interval_id);
					that.interval_id = null;

					setTimeout(function () {
						that.emit("processVar", {});
					}, that.timeoutDelay);
				}

			} else { // it's just a regular variable request; any incoming message (even 'empty' ones) are fine

				setTimeout(function () {
					that.emit("getVar", {});
				}, that.timeoutDelay);

			}
		});

		// Perform operations based on the method parameter.
		this.on("processVar", function () {
			// Check for repeat and start timer
			if (that.repeat && !isNaN(that.repeat) && that.repeat > 0) {
				that.interval_id = setInterval(function () {
					that.emit("getVar", {});
				}, that.repeat);
			}
			// There is no repeat, just start once
			else if (that.getvar && that.getvar.length > 0) {
				setTimeout(function () {
					that.emit("getVar", {});
				}, that.timeoutDelay);
			}
		});

		// Read Particle Device variable
		this.on("getVar", function () {
			that.trace("Retrieving variable...");
			that.trace("\t\tDevice ID: " + that.devid);
			that.trace("\t\tVariable Name: " + that.getvar);
			if (that.productIdOrSlug) that.trace("\tProduct: " + that.productIdOrSlug);

			let options = {
				auth: that.pcloud.credentials.accesstoken,
				deviceId: that.devid,
				name: that.getvar,
			};

			if (that.productIdOrSlug) options.product = that.productIdOrSlug;

			var vaPr = that.pcloud.particleJS.getVariable(options);
			vaPr.then(
				function (data) {
					if (data.statusCode == 200) {
						that.trace("Variable retrieved successfully");
						let msg = {
							raw: data.body,
							payload: data.body.result,
							id: data.body.coreInfo.deviceID
						};
						that.send(msg);
					}
				},
				function (err) {
					that.error(err.body);
				}
			).catch(function () {
				that.error("Promise Rejected");
			});

		});

		this.on("close", function () {
			if (that.interval_id) {
				that.trace("Interval closed.");
				clearInterval(that.interval_id);
			}
		});
	}
	// register ParticleVar node
	RED.nodes.registerType("particle-var", ParticleVar);
	// end ParticleVar
};
