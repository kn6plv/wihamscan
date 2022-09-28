const Log = require("debug")("wipryclarity");
const native = require("bindings")("WiPryClarity");
const EventEmitter = require("events");

const BAND_RSSI_2_4GHZ = 0;
const BAND_RSSI_5GHZ = 1;
const BAND_RSSI_6E = 2;

const bandInfo = {
    [BAND_RSSI_2_4GHZ]: {
        minFreq: 2400,
        maxFreq: 2500,
        samples: 256,
        period: 0.25,
    },
    [BAND_RSSI_5GHZ]: {
        minFreq: 5145,
        maxFreq: 5860,
        samples: 512,
        period: 1
    },
    [BAND_RSSI_6E]: {
        minFreq: 5925,
        maxFreq: 7125,
        samples: 768,
        period: 1.5
    }
}

class WiPryClarity extends EventEmitter {

    constructor() {
        super();

        this.BAND_2_4GHZ = BAND_RSSI_2_4GHZ;
        this.BAND_5GHZ = BAND_RSSI_5GHZ;
        this.BAND_6E = BAND_RSSI_6E;

        this.monitor = new native.MyMonitor();
        this.onCallback = this.onCallback.bind(this);
        this.monitor.registerCallback(this.onCallback);
        this.opened = 0;
        this.config = null;
        this.band = null;
    }

    open(band) {
        Log("open", band);
        this.opened++;
        if (this.opened === 1) {
            this.band = typeof band == "number" ? band : this.BAND_5GHZ;
            this.monitor.open(this.band);
        }
        else if (this.config) {
            Log("reconnected", this.config);
            this.emit("connected", this.config);
        }
    }

    close() {
        Log("close");
        if (--this.opened <= 0) {
            this.opened = 0;
            this.monitor.close();
        }
    }

    changeBand(band) {
        if (band !== this.band) {
            this.band = band;
            this.monitor.close();
            this.monitor.open(this.band);
        }
    }

    onCallback(type, code, a, b, c, d, e, f, g, h) {
        switch (type) {
            case 1: // RSSIDATA
                Log("rssidata", type, a.length);
                if (code == this.band) {
                    this.emit("rssidata", type, a);
                }
                break;
            case 2: // CONNECTED
                if (code) {
                    Log(a, b, c, d, e, f, g, h);
                    const band = bandInfo[this.band];
                    this.config = {
                        minRssi: (a + d) / 2,
                        maxRssi: Math.min(-40, (b + e) / 2),
                        noise: (c + f) / 2,
                        minFreq: band.minFreq, // g,
                        maxFreq: band.maxFreq, // h,
                        samples: band.samples,
                        period: band.period
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
