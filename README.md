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

You can also set up multiple cloud connections if you are running a standalone cloud server (`spark-server`). As development on `spark-server` seems to have stalled, you'll need to work out the

Please refer to the help sidebar in node-RED for full details on each node.

Basic Example
-------------

Write something similar to this in your Particle Build code:

```
void loop() {
    Particle.publish("randomnumber", String(random(100)), PRIVATE);
    delay(10000);
}
```

In node-RED, drop a Particle SSE node into the workspace, and connect a debug node to view the output:

_[todo: image]_


Remember to configure the Particle node by adding your own Particle configuration credentials and access token.

View the results via the debug node.


FAQ
---

  **Are these nodes the same thing as the Particle IoT Rules Engine?**  
  Conceptually, they are identical. `node-red-contrib-particle` has been around as an open-source project and maintained since 2015, when Node-RED was still in its early stages. From the documentation, it appears that the Particle nodes offered in the IoT Rules Engine node possess very similar node configuration options for each Particle node. The Particle IoT Rules Engine is a separate product delivered by Particle.io that runs atop a customised Node-RED framework. `node-red-contrib-particle` here can be installed on any Node-RED setup, is free, open-source and welcomes PRs, but requires knowledge on setting up your own (read: make it secure!) Node-RED environment.

  **I keep getting an Error in the ParticleSSE node!**  
  It's likely your Particle.io access token is incorrect. Regenerate a new token in build.particle.io, and try again with the new token in the configuration node.

  **ParticleFunc/ParticleVar/ParticlePublish seems slow and laggy**  
  Bear in mind the throttling limits for Particle event publishing. While the limit of ["1 event/sec with bursts of up to 4 allowed in 1 second"](https://docs.particle.io/reference/firmware/raspberry-pi/#particle-publish-) is embedded within the device firmware itself, the Particle Cloud server also applies its own throttling limits on the server side. Unless you have a very fast connection to the Particle Cloud server (or your own local spark-server), you have to expect the inherent latency for round trips between your Particle device, the Particle Cloud and your Node-RED server. This can also be completely circumvented by hosting your own `spark-server` with rate limits disabled, as with the same throttling limits removed from your Particle system firmware. The scope of this is beyond what this FAQ can offer; look around to find out how it can be done.


Local Cloud and SSE Limitations
-------------------------------

There are [current limitations with the local cloud package from Particle](https://github.com/spark/spark-server/issues/53), which prevents any subscription of device-specific and device-and-event-specific events. Effectively, if you are attempting to subscribe to a local cloud, you are currently only able to listen in on the public firehose (ALL SSEs), or on the event-specific public firehose. Use a function node to parse out what you need.

An equivalent of such requests using the RESTful API will resemble:

`http://particlecloud.local:8080/v1/events/&access_token=123abc...xyz`

`http://particlecloud.local:8080/v1/events/someEvent&access_token=123abc...xyz`

Refer to the [official Particle documentation on the Cloud API](https://docs.particle.io/reference/api/) for further details.


Credits
-------

This is a forked project that built off @krvarma's `node-red-contrib-sparkcore` initial work (0.0.12).

Additional features implemented since `node-red-contrib-particle 0.0.2+`:
* local cloud SSE (limited) support
* configuration node implementation
* dynamic property setting
* implementation of separate nodes for clarity
* renaming to Particle and other cosmetic fixes.

0.0.9 introduced the ParticleFunc node for calling Particle functions from Node-RED (@techlemur)
