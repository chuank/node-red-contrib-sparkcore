node-red-contrib-particle
-------------------------

Node-RED node to connect to [Particle Devices](https://www.particle.io/), either via the Particle.io Cloud, or a locally installed `spark-server`. This can be used to connect to the Particle Devices (currently: Core/Photon/P1/Electron/Argon/Boron/Xenon) to publish Events, call Functions, read Variables, listen to Server-Sent-Events (SSEs) and retrieve device details.

Install
-------

    npm install node-red-contrib-particle


Upgrading
---------
IMPORTANT: v1.0.0 introduces a few major breaking changes as it now adopts the [Particle JS API](https://github.com/particle-iot/particle-api-js). The codebase has been updated to be in line with the latest Node-RED recommendations. The node names have also been changed for styling consistency with other nodes.

The Manage Palette UI should upgrade dependencies without issue, so long as you restart your Node-RED server after. What you will encounter after the upgrade is 'missing' nodes due to the renaming of the Particle node names – please set up your Particle nodes again. Sorry.

If you are upgrading from a shell, run the following:

    cd ~/.node-red/node_modules
    npm install node-red-contrib-particle

(Above assumes that your Node-RED user folder is set to `~/.node-red`)


Usage
-----

Five nodes are provided to interact with Particle Devices – call a Function, read a Variable, subscribe to SSEs (server-sent events), publish Events on the Particle Cloud, and a Utility node to call and view/signal devices with. The nodes have both INPUT and OUTPUTs – sending appropriate messages (using `msg.topic` & `msg.payload`) to the INPUT allows you to change the parameters dynamically.

Where appropriate, the OUTPUT provides returned JSON data from the Particle Cloud after a query has been made.

You can also set up multiple cloud connections, which is handy if you are running a standalone cloud server (`spark-server`). As development on `spark-server` seems to have stalled, you'll need to explore forks done by other members of the community.

Please refer to the help sidebar in node-RED for full usage details.


Example: Publish & SSE
----------------------

Import the following into Node-RED using __Menu > Import > Clipboard__. Make sure you complete cloud configuration and access token before testing. If everything is correctly configured, the Particle SSE node should print out the timestamp of the server in the debug sidebar when you click on the Inject button, which publishes a private event to the Particle Cloud.

```
[{"id":"88110acf.02ebc8","type":"inject","z":"cd291985.954df8","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":120,"y":60,"wires":[["d65af38a.6b537"]]},{"id":"3ff5bc39.0c7844","type":"debug","z":"cd291985.954df8","name":"result","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","x":510,"y":140,"wires":[]},{"id":"d65af38a.6b537","type":"particle-pub","z":"cd291985.954df8","pcloud":"","evtname":"myEvent","param":"","productIdOrSlug":"","private":false,"evtnametopic":false,"ttl":60,"repeat":0,"once":false,"x":300,"y":60,"wires":[["f5737ed3.35db3"]]},{"id":"93630f0b.5cf93","type":"particle-SSE","z":"cd291985.954df8","pcloud":"","subscribetype":"mine","devprodslug":"__DEVPRODSLUG__","devid":"","evtname":"myEvent","strict":0,"x":320,"y":140,"wires":[["3ff5bc39.0c7844"]]},{"id":"f5737ed3.35db3","type":"debug","z":"cd291985.954df8","name":"result","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","x":470,"y":60,"wires":[]}]
```


Example: Function & Variables
-----------------------------

Name your Particle Device `myDevice`. Upload this to your Particle device:

```
int aValue = 0;

void setup() {
  pinMode(D7, OUTPUT);
  Particle.function("doLED", doLED);
  Particle.variable("aValue", aValue);
}

void loop() {
  // assume you have an analog sensor attached to A0:
  aValue = analogRead(A0);
}

int doLED(String cmd) {
  bool ledState = atoi(cmd);
  digitalWrite(D7, ledState)
}
```

In Node-RED, import the following from __Menu > Import > Clipboard__ (don't forget to set your device name and access tokens):

```
[{"id":"1e5bda0c.fd5296","type":"inject","z":"cd291985.954df8","name":"LED on","topic":"param","payload":"1","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":130,"y":60,"wires":[["c657c33.592be4"]]},{"id":"81f82594.4a0048","type":"inject","z":"cd291985.954df8","name":"LED off","topic":"param","payload":"0","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":130,"y":100,"wires":[["c657c33.592be4"]]},{"id":"be1d4443.bfcb08","type":"debug","z":"cd291985.954df8","name":"result","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","x":530,"y":80,"wires":[]},{"id":"ab4eb9a6.726948","type":"inject","z":"cd291985.954df8","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":120,"y":180,"wires":[["40f9446d.40ee6c"]]},{"id":"be1907a6.571198","type":"debug","z":"cd291985.954df8","name":"result","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"payload","x":530,"y":180,"wires":[]},{"id":"c657c33.592be4","type":"particle-func","z":"cd291985.954df8","pcloud":"","devid":"myDevice","fname":"doLED","param":"","productIdOrSlug":"","repeat":0,"once":false,"x":330,"y":80,"wires":[["be1d4443.bfcb08"]]},{"id":"40f9446d.40ee6c","type":"particle-var","z":"cd291985.954df8","pcloud":"","devid":"myDevice","getvar":"aValue","productIdOrSlug":"","repeat":0,"once":false,"x":320,"y":180,"wires":[["be1907a6.571198"]]}]
```

You should be able to turn the built-in D7 LED on your Photon on/off. The second flow allows you to print out aValue, which is reading off the A0 pin.



FAQ
---

  __Are these nodes the same thing as the Particle IoT Rules Engine?__  
  Conceptually, they are identical. `node-red-contrib-particle` has been around as an open-source project and maintained since 2015, when Node-RED was still in its early stages. From the IoT Rules Engine documentation, it appears that the Particle nodes offered in the IoT Rules Engine node possess very similar features and configuration options for each Particle node. The Particle IoT Rules Engine is a separate product delivered by Particle.io that runs atop a customised Node-RED framework.

  `node-red-contrib-particle` is intended to be installed on any Node-RED setup, is free, open-source and welcomes PRs, but requires knowledge on setting up your own (read: make it secure!) Node-RED environment.

  __I keep getting an Error in the ParticleSSE node!__  
  It's likely your Particle.io access token is incorrect. Regenerate a new token in build.particle.io, and try again with the new token in the configuration node.

  __ParticleFunc/ParticleVar/ParticlePublish seems slow and laggy__  
  Bear in mind the throttling limits for Particle event publishing. While the limit of ["1 event/sec with bursts of up to 4 allowed in 1 second"](https://docs.particle.io/reference/firmware/raspberry-pi/#particle-publish-) is embedded within the device firmware itself, the Particle Cloud server also applies its own throttling limits on the server side. Unless you have a very fast connection to the Particle Cloud server (or you are running your own local `spark-server`), expect the inherent latency for round trips between your Particle device, the Particle Cloud and your Node-RED server. This can also be circumvented by hosting your own `spark-server` with its rate limits disabled, and removing the throttling limits from your Particle device's system firmware (this requires recompiling of system firmware). The scope of how these two things can be done is beyond what this FAQ can offer.


Local Cloud and SSE Limitations
-------------------------------

There are [current limitations with the local cloud package from Particle](https://github.com/spark/spark-server/issues/53), which prevents any subscription of device-specific and device-and-event-specific events. Effectively, if you are attempting to subscribe to a local cloud, you are currently only able to listen in on the public firehose (ALL SSEs), or on the event-specific public firehose. Use a function node to parse out what you need.

An equivalent of such requests using the RESTful API will resemble:

`http://particlecloud.local:8080/v1/events/&access_token=123abc...xyz`

`http://particlecloud.local:8080/v1/events/someEvent&access_token=123abc...xyz`

Refer to the [official Particle documentation on the Cloud API](https://docs.particle.io/reference/api/) for further details.


Credits
-------

Please refer to LICENSE for open-source license and attribution details.

This is a forked project that built off @krvarma's initial work `node-red-contrib-sparkcore@v0.0.12`.

Additional features implemented since `node-red-contrib-particle v0.0.2+` by @chuank:
* product support
* utility node
* local cloud SSE (limited) support
* configuration node & credentials
* dynamic property setting
* implementation of separate nodes for clarity
* renaming to Particle and other cosmetic fixes.

v0.0.9: introduced the ParticleFunc node to easily call Particle functions from within Node-RED (@techlemur)
