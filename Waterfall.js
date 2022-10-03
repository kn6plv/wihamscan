
const EventEmitter = require("events");
const WiPryClarity = require("./WiPryClarity");

class Waterfall extends EventEmitter {

    constructor() {
        super();

        this._onConnected = this._onConnected.bind(this);
        this._onData = this._onData.bind(this);

        this.config = null;
        this.mon = WiPryClarity;
    }

    open() {
        this.mon.on("connected", this._onConnected);
        this.mon.on("rssidata", this._onData);
        this.mon.open();
    }

    close() {
        this.mon.close();
        this.mon.off("connected", this._onConnected);
        this.mon.off("rssidata", this._onData);
    }

    _onConnected(config) {
        this.config = config;
        this.points = new Float32Array(this.config.samples);
    }

    _onData(_, data) {
        const now = Date.now();
        for (let i = this.points.length - 1; i >= 0; i--) {
            const opoint = this.points[i];
            const npoint = data[i];
            if (npoint > opoint || opoint == 0) {
                this.points[i] = npoint;
            }
            else {
                this.points[i] = opoint * 0.9 + npoint * 0.1;
            }
        }
        this.period = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        this.emit("update");
    }

}

module.exports = Waterfall;
