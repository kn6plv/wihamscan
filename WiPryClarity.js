const Log = require("debug")("wipryclarity");
const native = require("bindings")("WiPryClarity");
const EventEmitter = require("events");

class WiPryClarity extends EventEmitter {

    constructor() {
        super();
        this.monitor = new native.MyMonitor();
        this.onCallback = this.onCallback.bind(this);
        this.monitor.registerCallback(this.onCallback);
        this.opened = false;
        this.config = null;
    }

    open() {
        Log("open");
        if (!this.opened) {
            this.opened = true;
            this.monitor.open();
        }
        else if (this.config) {
            Log("reconnected", this.config);
            this.emit("connected", this.config);
        }
    }

    close() {
        Log("close");
        if (this.opened) {
            this.opened = false;
            this.monitor.close();
        }
    }

    onCallback(type, code, a, b, c, d, e, f, g, h) {
        switch (type) {
            case 1: // RSSIDATA
                Log("rssidata", type, a.length);
                this.emit("rssidata", type, a);
                break;
            case 2: // CONNECTED
                if (code) {
                    this.config = {
                        minRssi: (a + d) / 2,
                        maxRssi: Math.min(-40, (b + e) / 2),
                        noise: (c + f) / 2,
                        minFreq: g,
                        maxFreq: h,
                        samples: 512
                    };
                    Log("connected", this.config);
                    this.emit("opened");
                    this.emit("connected", this.config);
                }
                else {
                    Log("unconnected");
                    this.emit("error", "connection failed");
                }
                break;
            default:
                Log("callback", type, code, a, b, c, d, e, f, g, h);
                break;
        }
    }

}

module.exports = new WiPryClarity();
