
const EventEmitter = require("events");
const WiPryClarity = require("./WiPryClarity");

class Graph extends EventEmitter {

    constructor() {
        super();

        this._onConnected = this._onConnected.bind(this);
        this._onData = this._onData.bind(this);

        this.config = null;
        this.mon = WiPryClarity;
        this.lastUpdate = Date.now();
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
        const period = (now - this.lastUpdate) / 1000;
        const keep = Math.pow(0.5, period);
        this.lastUpdate = now;
        this.period = period;
        for (let i = this.points.length - 1; i >= 0; i--) {
            const opoint = this.points[i];
            const npoint = data[i];
            if (npoint > opoint || opoint === 0) {
                this.points[i] = npoint;
            }
            else {
                this.points[i] = opoint * keep + npoint * (1 - keep);
            }
        }
        this.emit("update");
    }

}

module.exports = Graph;
