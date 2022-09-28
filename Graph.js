
const EventEmitter = require("events");
const WiPryClarity = require("./WiPryClarity");

class Graph extends EventEmitter {

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
        const offset = -this.config.noise;
        const scale = 100 / (this.config.maxRssi - this.config.noise);
        for (let i = this.points.length - 1; i >= 0; i--) {
            const opoint = this.points[i];
            const npoint = (data[i] + offset) * scale;
            if (npoint > opoint) {
                this.points[i] = npoint;
            }
            else {
                this.points[i] = opoint * 0.5 + npoint * 0.5;
            }
        }
        this.emit("update");
    }

}

module.exports = Graph;
