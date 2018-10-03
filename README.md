node-red-contrib-particle
-------------------------

Node-RED node to connect to [Particle Devices](https://www.particle.io/), either via local cloud, or the Particle.io cloud. This can be used to connect to the Particle Core/Photon/P1/Electron, call functions, read variables or listen to Server-Sent-Events (SSEs).

Install
-------

    npm install node-red-contrib-particle

Usage
-----

Four separate nodes are provided to interact with Particle Devices – call a function, read a variable, subscribe to SSEs (server-sent events) and publish events on the Particle Cloud. The nodes have both INPUT and OUTPUTs – sending appropriate messages (using `msg.topic` & `msg.payload`) to the INPUT allows you to change the parameters dynamically.

Where appropriate, the OUTPUT provides returned data from the Particle Cloud after a query has been made.

You can also set up multiple cloud connections if you are running a standalone cloud server (`spark-server`). As development on `spark-server` seems to have stalled, you'll

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


Example Using ParticlePublish & ParticleSSE
-------------------------------------------

```

```



Remember to configure the Particle node by adding your own Particle configuration credentials and access token.

View the results via the debug node.


FAQ
---

  **Is this the same thing as the Particle IoT Rules Engine?**  
  Conceptually, they are identical. `node-red-contrib-particle` has been around as an open-source project and maintained since 2015, when Node-RED was still in its early stages. The Particle IoT Rules Engine is a separate product delivered by Particle.io that runs atop the same Node-RED framework. From the early documentation, it appears that the IoT Rules Engine node possesses very similar node configuration options for each Particle node. `node-red-contrib-particle` is free for use, but requires you to set up your own Node-RED environment. I would imagine that the IoT Rules Engine provides a faster entry point to the Node-RED environment.

  **I keep getting an Error in the ParticleSSE node!**  
  It's likely your Particle.io access token is incorrect. Regenerate a new token in build.particle.io, and try again with the new token in the configuration node.

  **ParticleFunc/ParticleVar/ParticlePublish seems slow and laggy**  
  Bear in mind the throttling limits for Particle event publishing. While the limit of ["1 event/sec with bursts of up to 4 allowed in 1 second"](https://docs.particle.io/reference/firmware/raspberry-pi/#particle-publish-) is embedded within the device firmware itself, the Particle Cloud server also applies its own throttling limits on the server side. Unless you have a very fast connection to the Particle Cloud server (or your own local spark-server), you have to expect the inherent latency for round trips between your Particle device, the Particle Cloud and your Node-RED server.


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
