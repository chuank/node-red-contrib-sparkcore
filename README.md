node-red-contrib-particle
-------------------------

Node-RED node to connect to [Particle Devices](https://www.particle.io/), either via local cloud, or the Particle.io cloud. This can be used to connect to the Particle Core/Photon/P1/Electron, publish Events, call Functions, read Variables or listen to Server-Sent-Events (SSEs).

Install
-------

    npm install node-red-contrib-particle

Usage
-----

Four separate nodes are provided to interact with Particle Devices – call a Function, read a Variable, subscribe to SSEs (server-sent events) and publish Events on the Particle Cloud. The nodes have both INPUT and OUTPUTs – sending appropriate messages (using `msg.topic` & `msg.payload`) to the INPUT allows you to change the parameters dynamically.

Where appropriate, the OUTPUT provides returned data from the Particle Cloud after a query has been made.

You can also set up multiple cloud connections if you are running a standalone cloud server (`spark-server`). As development on `spark-server` seems to have stalled, you'll need to explore forks done by other members of the community.

Please refer to the help sidebar in node-RED for full details on each node.


Example: Publish & SSE
----------------------

Import the following into Node-RED using __Menu > Import > Clipboard__. Complete cloud configuration and access token before testing. If everything is correctly configured, the Particle SSE node should print out the timestamp of the server in the debug sidebar when you click on the Inject button, which publishes a private event to the Particle Cloud.

```
[{"id":"4e1ed5ee.a82c0c","type":"ParticleSSE in","z":"1bba2c1b.324be4","pcloud":"70ab2f2a.25f9b","evtname":"myEvent","devid":"","consolelog":false,"x":560,"y":160,"wires":[["d0201000.a0de7"]]},{"id":"5141baba.30e574","type":"inject","z":"1bba2c1b.324be4","name":"","topic":"myEvent","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":200,"y":80,"wires":[["80bfead3.defba8"]]},{"id":"d0201000.a0de7","type":"debug","z":"1bba2c1b.324be4","name":"result","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","x":720,"y":160,"wires":[]},{"id":"80bfead3.defba8","type":"ParticlePublish out","z":"1bba2c1b.324be4","pcloud":"70ab2f2a.25f9b","evtname":"myEvent","evtnametopic":true,"param":"","private":true,"ttl":60,"once":false,"repeat":"0","consolelog":true,"x":460,"y":80,"wires":[[]]},{"id":"70ab2f2a.25f9b","type":"particle-cloud","z":"","host":"https://api.particle.io","port":"443","accesstoken":"__PWRD__","name":"Particle.io"}]
```


Example: Function & Variables
-----------------------------

Upload this to your Photon:

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
[{"id":"2244ae44.fdc752","type":"ParticleFunc out","z":"1bba2c1b.324be4","pcloud":"70ab2f2a.25f9b","devid":"myDevice","fname":"doLED","param":"","once":false,"repeat":"0","consolelog":false,"x":390,"y":420,"wires":[["139a92b1.04c17d"]]},{"id":"eadbd74f.855928","type":"inject","z":"1bba2c1b.324be4","name":"LED on","topic":"param","payload":"1","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":190,"y":400,"wires":[["2244ae44.fdc752"]]},{"id":"39b5dce1.62e274","type":"inject","z":"1bba2c1b.324be4","name":"LED off","topic":"param","payload":"0","payloadType":"str","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":190,"y":440,"wires":[["2244ae44.fdc752"]]},{"id":"139a92b1.04c17d","type":"debug","z":"1bba2c1b.324be4","name":"result","active":true,"tosidebar":true,"console":false,"tostatus":true,"complete":"payload","x":590,"y":420,"wires":[]},{"id":"e04e2652.0b7388","type":"ParticleVar","z":"1bba2c1b.324be4","pcloud":"70ab2f2a.25f9b","devid":"myDevice","getvar":"aValue","once":false,"repeat":0,"consolelog":false,"x":380,"y":540,"wires":[["7a3f926a.5d0b3c"]]},{"id":"283e0e5c.9a54c2","type":"inject","z":"1bba2c1b.324be4","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":180,"y":540,"wires":[["e04e2652.0b7388"]]},{"id":"7a3f926a.5d0b3c","type":"debug","z":"1bba2c1b.324be4","name":"result","active":true,"tosidebar":true,"console":false,"tostatus":true,"complete":"payload","x":590,"y":540,"wires":[]},{"id":"70ab2f2a.25f9b","type":"particle-cloud","z":"","host":"https://api.particle.io","port":"443","accesstoken":"__PWRD__","name":"Particle.io"}]
```

You should be able to turn the built-in D7 LED on your Photon on/off. The second flow allows you to print out aValue, which is reading off the A0 pin.



FAQ
---

  **Are these nodes the same thing as the Particle IoT Rules Engine?**  
  Conceptually, they are identical. `node-red-contrib-particle` has been around as an open-source project and maintained since 2015, when Node-RED was still in its early stages. From the IoT Rules Engine documentation, it appears that the Particle nodes offered in the IoT Rules Engine node possess very similar features and configuration options for each Particle node. The Particle IoT Rules Engine is a separate product delivered by Particle.io that runs atop a customised Node-RED framework.

  `node-red-contrib-particle` is intended to be installed on any Node-RED setup, is free, open-source and welcomes PRs, but requires knowledge on setting up your own (read: make it secure!) Node-RED environment.

  **I keep getting an Error in the ParticleSSE node!**  
  It's likely your Particle.io access token is incorrect. Regenerate a new token in build.particle.io, and try again with the new token in the configuration node.

  **ParticleFunc/ParticleVar/ParticlePublish seems slow and laggy**  
  Bear in mind the throttling limits for Particle event publishing. While the limit of ["1 event/sec with bursts of up to 4 allowed in 1 second"](https://docs.particle.io/reference/firmware/raspberry-pi/#particle-publish-) is embedded within the device firmware itself, the Particle Cloud server also applies its own throttling limits on the server side. Unless you have a very fast connection to the Particle Cloud server (or you are running your own local `spark-server`), expect the inherent latency for round trips between your Particle device, the Particle Cloud and your Node-RED server. This can also be circumvented by hosting your own `spark-server` with rate limits disabled, as with the same throttling limits removed from your Particle system firmware. The scope of this is beyond what this FAQ can offer; look around to find out how it can be done.


Local Cloud and SSE Limitations
-------------------------------

There are [current limitations with the local cloud package from Particle](https://github.com/spark/spark-server/issues/53), which prevents any subscription of device-specific and device-and-event-specific events. Effectively, if you are attempting to subscribe to a local cloud, you are currently only able to listen in on the public firehose (ALL SSEs), or on the event-specific public firehose. Use a function node to parse out what you need.

An equivalent of such requests using the RESTful API will resemble:

`http://particlecloud.local:8080/v1/events/&access_token=123abc...xyz`

`http://particlecloud.local:8080/v1/events/someEvent&access_token=123abc...xyz`

Refer to the [official Particle documentation on the Cloud API](https://docs.particle.io/reference/api/) for further details.


Credits
-------

This is a forked project that built off @krvarma's `node-red-contrib-sparkcore` initial work (v0.0.12).

Additional features implemented since `node-red-contrib-particle v0.0.2+` by @chuank:
* local cloud SSE (limited) support
* configuration node & credentials
* dynamic property setting
* implementation of separate nodes for clarity
* renaming to Particle and other cosmetic fixes.

v0.0.9: introduced the ParticleFunc node for calling Particle functions from Node-RED (@techlemur)
