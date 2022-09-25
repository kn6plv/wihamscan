
const EventEmitter = require("events");
const WiPryClarity = require("./WiPryClarity");

class Waterfall extends EventEmitter {

    constructor() {
        super();
        this.config = null;
        this.mon = WiPryClarity;
    }

    open() {
        this.mon.on("connected", config => {
            this.config = config;
            this.points = new Float32Array(this.config.samples);
        });
        this.mon.on("rssidata", (_, data) => {
            const offset = -this.config.noise;
            const scale = 100 / (this.config.maxRssi - this.config.noise);
            for (let i = this.points.length - 1; i >= 0; i--) {
                const opoint = this.points[i];
                const npoint = (data[i] + offset) * scale;
                if (npoint > opoint) {
                    this.points[i] = npoint;
                }
                else {
                    this.points[i] = opoint * 0.9 + npoint * 0.1;
                }
            }
            this.emit("update");
        });
        this.mon.open();
    }

    close() {
    }

}

module.exports = Waterfall;
