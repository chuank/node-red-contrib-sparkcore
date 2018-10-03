/*
  https://github.com/chuank/node-red-contrib-particle
*/

var EventSource = require("eventsource");
var Request = require("request");
var querystring = require("querystring");

module.exports = function(RED) {

	// ******************************************
	// Configuration module - handles credentials
	// ******************************************
	function ParticleCloudNode(n) {
		RED.nodes.createNode(this, n);
		this.host = n.host;
		this.port = n.port;
		this.name = n.name;

		if (this.credentials && this.credentials.hasOwnProperty("accesstoken")) {
			this.accesstoken = this.credentials.accesstoken;
		}
	}
	// register the existence of the Particle Cloud credentials configuration node
	RED.nodes.registerType("particle-cloud", ParticleCloudNode, {
		credentials: {
			accesstoken: {
				type: "password"
			}
		}
	});

	// *********************************************************************
	// ParticleSSE node - base module for subscribing to Particle Cloud SSEs
	// *********************************************************************
	function ParticleSSE(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleSSE nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties from node instance settings
		this.config = n;
		this.devid = n.devid;
		this.evtname = n.evtname;
		this.baseurl = RED.nodes.getNode(n.baseurl);
		this.consolelog = n.consolelog;
		this.timeoutDelay = 5; // ms

		// keep track of updated state (for updating status icons)
		this.propChanged = false;

		// console.log("(ParticleSSE) INIT cloud url:", Object.keys(this.baseurl));
		// console.log("(ParticleSSE) INIT access token:", this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false: this.isLocal = true;

		if (this.baseurl.accesstoken == null || this.baseurl.accesstoken === "") {
			this.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		setTimeout(function() {
			particlemodule.emit("processSSE", {});
		}, this.timeoutDelay);

		// Called when there an input from upstream node(s)
		this.on("input", function(msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var val = msg;

			// ignore if incoming message is invalid; otherwise store incoming message as new event name
			if (val != null) {
				if (val.topic === "evtname") {
					this.evtname = val.payload;
					this.propChanged = true;
					if (this.consolelog) console.log("(ParticleSSE) input new eventName:", this.evtname);
					validOp = true;
				} else if (val.topic === "devid") {
					this.devid = val.payload;
					this.propChanged = true;
					if (this.consolelog) console.log("(ParticleSSE) input new devID:", ((this.devid === "") ? "(noDevID/firehose)" : this.devid));
					validOp = true;
				}
			}

			if (validOp) {
				// show 'reconnecting status' while the new parameters are setup
				this.status({
					fill: "yellow",
					shape: "dot",
					text: "Reconnecting..."
				});
			}

			setTimeout(function() {
				particlemodule.emit("processSSE", {});
			}, this.timeoutDelay);

		});

		// SSE (Server-Sent-Event) Subscription
		this.on("processSSE", function() {
			// if we're dealing with a local cloud, or if device ID is empty, fallback to public/event firehose & ignore device ID
			var url;
			var eventname = encodeURIComponent(this.evtname);
			if (this.isLocal || !this.devid) {
				url = this.baseurl.host + ":" + this.baseurl.port + "/v1/events/" + eventname + "?access_token=" + this.baseurl.accesstoken;
			} else {
				url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/" + this.devid + "/events/" + eventname + "?access_token=" + this.baseurl.accesstoken;
			}

			if (this.esSSE != undefined) {
				this.esSSE.close(); // close any pre-existing, open connections
			}

			// console.log("(ParticleSSE) ES attempt to:", url);
			this.esSSE = new EventSource(url);

			var evt = this.evtname;

			// Add EventSource Listener
			this.esSSE.addEventListener(evt, function(e) {
				var data = JSON.parse(e.data);
				var msg = {
					raw: data,
					evtname: evt,
					payload: data.data,
					published_at: data.published_at,
					id: data.coreid // FIXME/REMINDER: currently spark-server still uses coreid as property name
				};
				particlemodule.send(msg);
			}, false);

			this.esSSE.onopen = function() {
				particlemodule.status({
					fill: "green",
					shape: particlemodule.propChanged ? "ring" : "dot",
					text: particlemodule.propChanged ? "evtname/devid UPDATED OK" : "Connected"
				});
				if (this.consolelog) console.log("(ParticleSSE) Connected");
			};

			this.esSSE.onclose = function() {
				particlemodule.status({
					fill: "grey",
					shape: "dot",
					text: "Closed"
				});
				if (this.consolelog) console.log("(ParticleSSE) Closed");
			};

			this.esSSE.onerror = function() {
				particlemodule.status({
					fill: "red",
					shape: "ring",
					text: "Error - refer to log"
				});
				if (this.consolelog) console.log("(Particle SSE) Error");
			};
		});
	}
	// register ParticleSSE node
	RED.nodes.registerType("ParticleSSE in", ParticleSSE, {});
	// end SSE (Server-Sent-Event) Subscription



	// **************************************************************************
	// ParticlePublish node - base module for submitting events to Particle Cloud
	// **************************************************************************
	function ParticlePublish(n) {
		// note:
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticlePublish nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties from node instance settings
		this.config = n;
		this.param = n.param; // string data to send as part of published Particle Event
		this.evtname = n.evtname; // name of Particle Event to publish
		this.baseurl = RED.nodes.getNode(n.baseurl);
		this.evtnametopic = n.evtnametopic;
		this.private = n.private;
		if(n.ttl === "" || n.ttl == null) {
			this.ttl = 60;
		} else {
			this.ttl = n.ttl;
		}
		this.once = n.once;
		this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.consolelog = n.consolelog;
		this.timeoutDelay = 5; // ms

		// keep track of updated state (for updating status icons)
		this.propChanged = false;

		// console.log("(ParticlePublish) INIT cloud url:", Object.keys(this.baseurl));
		// console.log("(ParticlePublish) INIT access token:", this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false: this.isLocal = true;

		if (this.baseurl.accesstoken == null || this.baseurl.accesstoken === "") {
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
			setTimeout(function() {
				particlemodule.emit("callPublish", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function(msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;
			var execPub = false;

			// ignore if incoming message is invalid
			if (val != null) {
				if (val.topic === "evtname") {				// set new Event name; does not trigger publish Event
					this.evtname = val.payload;
					this.propChanged = true;
					if (this.consolelog) console.log("(ParticlePublish) new publish Event name:", this.evtname);
					validOp = true;
				} else if (val.topic === "param") {		// new param (string data); trigger publish Event AND send param
					if (this.consolelog) console.log("(ParticlePublish) new param:", val.payload);
					validOp = execPub = true;
				} else if (val.topic === "repeat") {	// new repeat interval; updates interval timer (which in turn will trigger publish Event)
					val.payload = Number(val.payload) * 1000;
					this.repeat = val.payload;
					if (this.consolelog) console.log("(ParticlePublish) input new repeat (ms):", this.repeat);
					validOp = repeatChanged = true;
				} else if (this.evtnametopic && val.topic.length > 0) {
					// alternative usage mode: if user has selected the "Use topic as Event Name?" option
					this.evtname = val.topic;
					this.param = val.payload;
					validOp = execPub = true;
					if (this.consolelog) console.log("(ParticlePublish) evtnametopic publish Event:", this.evtname, ":", this.param);
				} else if ((val.topic == null || val.topic == "") && val.payload != null) {
					// 'shortcut' mode - easier way to publish the Event without specifying "param" as topic
					// a Particle Publish Event has the option of sending a data string along with the published Event
					// To streamline the use of the Publish node, any incoming payload (without a topic) should trigger the Event – but NOT send any data
					// To send data as part of the publish Event, the upstream message MUST include the topic "param"
					val.payload = "";
					validOp = execPub = true;
					if (this.consolelog) console.log("(ParticlePublish) shortcut publish Event:", this.evtname);
				}
			}

			if (validOp) {
				// signal to user that incoming messages have modified node settings
				if (execPub) {
					this.status({
						fill: "blue",
						shape: "dot",
						text: this.evtname + ":" + this.param + " SENT"
					});
				} else {
					this.status({
						fill: "green",
						shape: "ring",
						text: val.topic + " changed to " + val.payload
					});
				}

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(this.interval_id);
					this.interval_id = null;

					setTimeout(function() {
						particlemodule.emit("processPublish", {});
					}, this.timeoutDelay);
				}
			}

			if (execPub) {
				if (this.evtname.length === 0 || this.evtname === "") { // Catch blank event name
					this.evtname = "NodeRED";
				}

				if (val && val.payload && val.payload.length > 0) {
					this.param = val.payload;
				}

				setTimeout(function() {
					particlemodule.emit("callPublish", {});
				}, this.timeoutDelay);
			}

		});

		// Perform operations based on the method parameter.
		this.on("processPublish", function() {
			// Check for repeat and start timer
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				this.interval_id = setInterval(function() {
					particlemodule.emit("callPublish", {});
				}, this.repeat);
			}
			// There is no repeat, just start once
			else if (this.getvar && this.getvar.length > 0) {
				setTimeout(function() {
					particlemodule.emit("callPublish", {});
				}, this.timeoutDelay);
			}
		});

		// Execute actual Publish Event call
		this.on("callPublish", function() {
			var url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/events";

			if (this.consolelog) {
				console.log("(ParticlePublish) Calling function...");
				console.log("\tURL:", url);
				console.log("\tEvent Name:", this.evtname);
				console.log("\tPrivate:", this.private);
				console.log("\tTTL:", this.ttl);
				console.log("\tParameter(s):", this.param);
			}

			// build POST data and publish Particle Event
			Request.post(
				url, {
					form: {
						access_token: this.baseurl.accesstoken,
						name: this.evtname,
						data: this.param,
						private: this.private,
						ttl: this.ttl
					}
				},
				function(error, response, body) {
					// If not error then prepare message and send
					if (!error && response.statusCode == 200) {
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.ok
						};
						particlemodule.send(msg);
					}
				}
			);
		});

	}
	// register ParticlePublish node
	RED.nodes.registerType("ParticlePublish out", ParticlePublish, {});
	// end ParticlePublish


	// ***************************************************************************
	// ParticleFunc node - base module for calling Particle device cloud functions
	// ***************************************************************************
	function ParticleFunc(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleFunc nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties
		this.config = n;
		this.baseurl = RED.nodes.getNode(n.baseurl);
		this.devid = n.devid;
		this.fname = n.fname;
		this.param = n.param;
		this.once = n.once;
		this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.consolelog = n.consolelog;
		this.timeoutDelay = 5; //ms

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false: this.isLocal = true;

		if (this.baseurl.accesstoken == null || this.baseurl.accesstoken === "") {
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
		if (this.devid == null || this.devid === "") {
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
			setTimeout(function() {
				particlemodule.emit("processFunc", {});
			}, this.timeoutDelay);
		}

		// Called when there an input from upstream node(s)
		this.on("input", function(msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;
			var execFunc = false;

			// ignore if incoming message is invalid
			if (val != null) {
				if (val.topic === "devid") {
					this.devid = val.payload;
					if (this.consolelog) console.log("(ParticleFunc) input new devid:", this.devid);
					validOp = true;
				} else if (val.topic === "fname") {
					this.fname = val.payload;
					if (this.consolelog) console.log("(ParticleFunc) input new funcName:", this.fname);
					validOp = true;
				} else if (val.topic === "param") {
					this.param = val.payload;
					if (this.consolelog) console.log("(ParticleFunc) input new param:", this.param);
					validOp = execFunc = true;
				} else if (val.topic === "repeat") {
					this.repeat = Number(val.payload) * 1000;
					if (this.consolelog) console.log("(ParticleFunc) input new repeat (ms):", this.repeat);
					validOp = repeatChanged = true;
				} else if ((val.topic == null || val.topic == "") && val.payload != null) { // 'shortcut' mode - easier way to call the function without specifying "param" as topic
					this.param = val.payload;
					validOp = execFunc = true;
					if (this.consolelog) console.log("(ParticleFunc) shortcut func call:", this.param);
				}
			}

			if (validOp) {
				// signal to user that incoming messages have modified node settings
				if (execFunc) {
					this.status({
						fill: "blue",
						shape: "dot",
						text: val.payload
					});
				} else {
					this.status({
						fill: "green",
						shape: "ring",
						text: val.topic + " changed to " + val.payload
					});
				}

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(this.interval_id);
					this.interval_id = null;

					setTimeout(function() {
						particlemodule.emit("processFunc", {});
					}, this.timeoutDelay);
				}
			}

			if (execFunc) {
				val = msg.payload;
				// Retrieve payload as param
				if (val && val.length > 0) {
					this.param = val;
				}

				setTimeout(function() {
					particlemodule.emit("callFunc", {});
				}, this.timeoutDelay);
			}

		});

		// Call Particle Function
		this.on("processFunc", function() {
			// Check for repeat and start timer
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				// console.log("(ParticleFunc) Repeat =", this.repeat);

				this.interval_id = setInterval(function() {
					particlemodule.emit("callFunc", {});
				}, this.repeat);

			}
			// There is no repeat, just start once
			else if (this.fname && this.fname.length > 0) {
				setTimeout(function() {
					particlemodule.emit("callFunc", {});
				}, this.timeoutDelay);
			}
		});

		// Execute actual Particle Device function call
		this.on("callFunc", function() {
			var url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/" + this.devid + "/" + this.fname;

			if (this.consolelog) {
				console.log("(ParticleFunc) Calling function...");
				console.log("\tURL:", url);
				console.log("\tDevice ID:", this.devid);
				console.log("\tFunction Name:", this.fname);
				console.log("\tParameter(s):", this.param);
			}

			// build POST data and call Particle Device function
			Request.post(
				url, {
					form: {
						access_token: this.baseurl.accesstoken,
						args: this.param
					}
				},
				function(error, response, body) {
					// If not error then prepare message and send
					if (!error && response.statusCode == 200) {
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id
						};
						particlemodule.send(msg);
					}
				}
			);
		});
	}
	// register ParticleFunc node
	RED.nodes.registerType("ParticleFunc out", ParticleFunc, {});


	// ***********************************************************************
	// ParticleVar node - base module for retrieving Particle device variables
	// ***********************************************************************
	function ParticleVar(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleVar nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties
		this.config = n;
		this.baseurl = RED.nodes.getNode(n.baseurl);
		this.devid = n.devid;
		this.getvar = n.getvar;
		this.once = n.once;
		this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.consolelog = n.consolelog;
		this.timeoutDelay = 5;

		// console.log("(ParticleVar) INIT cloud url:", Object.keys(this.baseurl));
		// console.log("(ParticleVar) INIT access token:", this.baseurl.accesstoken);

		(this.baseurl.host === "https://api.particle.io") ? this.isLocal = false: this.isLocal = true;

		if (this.baseurl.accesstoken == null || this.baseurl.accesstoken === "") {
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
		if (this.devid == null || this.devid === "") {
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
			setTimeout(function() {
				particlemodule.emit("processVar", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function(msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;

			// ignore if incoming message is invalid
			if (val != null) {
				if (val.topic === "devid") {
					this.devid = val.payload;
					if (this.consolelog) console.log("(ParticleVar) input new devid:", this.devid);
					validOp = true;
				} else if (val.topic === "getvar") {
					this.getvar = val.payload;
					if (this.consolelog) console.log("(ParticleVar) input new varName:", this.getvar);
					validOp = true;
				} else if (val.topic === "repeat") {
					val.payload = Number(val.payload) * 1000;
					this.repeat = val.payload;
					if (this.consolelog) console.log("(ParticleVar) input new repeat (ms):", this.repeat);
					validOp = repeatChanged = true;
				}
			}

			if (validOp) {
				// here we signal that incoming messages have modified node settings
				this.status({
					fill: "green",
					shape: "ring",
					text: val.topic + " modified to " + val.payload
				});

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(this.interval_id);
					this.interval_id = null;

					setTimeout(function() {
						particlemodule.emit("processVar", {});
					}, this.timeoutDelay);
				}

			} else { // it's just a regular variable request; any incoming message (even 'empty' ones) are fine

				setTimeout(function() {
					particlemodule.emit("getVar", {});
				}, this.timeoutDelay);

			}
		});

		// Perform operations based on the method parameter.
		this.on("processVar", function() {
			// Check for repeat and start timer
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				this.interval_id = setInterval(function() {
					particlemodule.emit("getVar", {});
				}, this.repeat);
			}
			// There is no repeat, just start once
			else if (this.getvar && this.getvar.length > 0) {
				setTimeout(function() {
					particlemodule.emit("getVar", {});
				}, this.timeoutDelay);
			}
		});

		// Read Particle Device variable
		this.on("getVar", function() {
			var url = this.baseurl.host + ":" + this.baseurl.port + "/v1/devices/" + this.devid + "/" + this.getvar + "?access_token=" + this.baseurl.accesstoken;

			if (this.consolelog) {
				console.log("(ParticleVar) Retrieving variable...");
				console.log("\tURL:", url);
				console.log("\tDevice ID:", this.devid);
				console.log("\tVariable Name:", this.getvar);
			}

			// Read Particle device variable and send output once response is received
			Request.get(url,
				function(error, response, body) {
					// console.log("(ParticleVar) received variable:", body);

					// If no error then prepare message and send to outlet
					if (!error && response.statusCode == 200) {
						var data = JSON.parse(body);

						var msg = {
							raw: data,
							payload: data.result,
							id: data.coreInfo.deviceID
						};

						particlemodule.send(msg);
					}
				}
			);
		});
	}
	// register ParticleVar node
	RED.nodes.registerType("ParticleVar", ParticleVar, {
		credentials: {
			devid: {
				type: "password"
			}
		}
	});



	// ****************************
	// GC upon termination of nodes
	// ****************************
	ParticleSSE.prototype.close = function() {
		if (this.esSSE != null) {
			if (this.consolelog) console.log("(ParticleSSE) EventSource closed.");
			this.esSSE.close();
		}
	};

	ParticlePublish.prototype.close = function() {
		// TODO: add interval?
	};

	ParticleFunc.prototype.close = function() {
		if (this.interval_id != null) {
			if (this.consolelog) console.log("(ParticleFunc) Interval closed.");
			clearInterval(this.interval_id);
		}
	};

	ParticleVar.prototype.close = function() {
		if (this.interval_id != null) {
			if (this.consolelog) console.log("(ParticleVar) Interval closed.");
			clearInterval(this.interval_id);
		}
	};


	// *************************************************
	// Credentials management for the configuration node
	// *************************************************
	RED.httpAdmin.get("/particle/:id", function(req, res) {
		var credentials = RED.nodes.getCredentials(req.params.id);

		if (credentials) {
			res.send(JSON.stringify({
				devid: credentials.devid
			}));
		} else {
			res.send(JSON.stringify({}));
		}
	});

	RED.httpAdmin.delete("/particle/:id", function(req, res) {
		RED.nodes.deleteCredentials(req.params.id);
		res.send(200);
	});

	RED.httpAdmin.post("/particle/:id", function(req, res) {
		var body = "";
		req.on("data", function(chunk) {
			body += chunk;
		});

		req.on("end", function() {
			var newCreds = querystring.parse(body);
			var credentials = RED.nodes.getCredentials(req.params.id) || {};
			if (newCreds.devid == null || newCreds.devid === "") {
				delete credentials.devid;
			} else {
				credentials.devid = newCreds.devid;
			}
			RED.nodes.addCredentials(req.params.id, credentials);
			res.send(200);
		});
	});

	RED.httpAdmin.get("/particlecloud/:id", function(req, res) {
		var credentials = RED.nodes.getCredentials(req.params.id);

		// console.log("particleCloud getCredentials:", credentials);

		if (credentials) {
			res.send(JSON.stringify({
				accesstoken: credentials.accesstoken
			}));
		} else {
			res.send(JSON.stringify({}));
		}
	});

	RED.httpAdmin.delete("/particlecloud/:id", function(req, res) {
		RED.nodes.deleteCredentials(req.params.id);
		res.send(200);
	});

	RED.httpAdmin.post("/particlecloud/:id", function(req, res) {
		var body = "";
		req.on("data", function(chunk) {
			body += chunk;
		});

		req.on("end", function() {
			var newCreds = querystring.parse(body);
			var credentials = RED.nodes.getCredentials(req.params.id) || {};

			// console.log("particleCloud postCredentials:", credentials);

			if (newCreds.accesstoken === "") {
				delete credentials.accesstoken;
			} else {
				credentials.accesstoken = newCreds.accesstoken || credentials.accesstoken;
			}
			RED.nodes.addCredentials(req.params.id, credentials);
			res.send(200);
		});
	});
};
