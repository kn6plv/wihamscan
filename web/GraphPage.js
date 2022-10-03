const Config = require("./Config");
const Graph = require("../Graph");
const BasePage = require("./BasePage");

const height = Config.graphHeight;
const width = Config.width;

function mkchan(from, to, base) {
    return {
        f: from,
        t: to,
        c: function(freq) {
            const c0 = (freq - from) / 5 + base;
            const c1 = Math.floor(c0);
            return `${c1}${c1 + 0.5 == c0 ? " (center)" : ""}`;
        }
    }
}

const channels = [
    mkchan(2384.5, 2486.5, -4),
    mkchan(3377.5, 3497.5, 76),
    mkchan(5032.5, 5997.5,  7)
];

class GraphPage extends BasePage {

    async cmd_init() {
        this.cursor = { x: null };

        this.graphUpdated = this.graphUpdated.bind(this);

        this.graph = new Graph();
        this.graph.open();
        this.graph.on("update", this.graphUpdated);
    }

    async cmd_close() {
        this.graph.off("update", this.graphUpdated);
        this.graph.close();
    }

    async cmd_move_cursor(msg) {
        this.cursor.x = msg.value.x;
        this.cursor.bandwidth = msg.value.w;
        this.pointUpdated();
    }

    async html() {
    }

    graphUpdated() {
        const points = this.graph.points;
        const config = this.graph.config;
        const len = points.length;
        const xscale = width / len;
        const yscale = height / (config.maxRssi - config.noise);
        let d = `M 0 ${height} L 0 ${(config.maxRssi - points[0]) * yscale}`;
        for (let i = 1; i < len; i++) {
            d += ` ${i * xscale} ${(config.maxRssi - points[i]) * yscale}`;
        }
        d += ` ${width} ${height} Z`;
        this.send("svg.path.update", {
            id: "graph-data-path",
            d: d,
            t: this.graph.period
        });
        this.pointUpdated();
    }

    pointUpdated() {
        const config = this.graph.config;
        const points = this.graph.points;
        if (typeof this.cursor.x === "number" && config && points) {
            const scale = (config.maxFreq - config.minFreq) / width;
            const centerMHz = Math.round(this.cursor.x * scale + config.minFreq);
            let channel = "-";
            for (let i = 0; i < channels.length; i++) {
                const c = channels[i];
                if (centerMHz >= c.f && centerMHz < c.t) {
                    channel = c.c(centerMHz);
                    break;
                }
            }
            let sp = Math.floor(this.cursor.x / width * points.length);
            let dbi = -140;
            for (let p = Math.max(0, this.cursor.bandwidth / scale - 1); p >= 0 && sp < points.length; p--, sp++) {
                const v = points[sp];
                if (v > dbi) {
                    dbi = v;
                }
            }
            this.send("html.update", {
                id: "band-info",
                html: this.Template.BandInfo({
                    freq: centerMHz,
                    signal: Math.round(dbi),
                    channel: channel
                })
            });
        }
        else {
            this.send("html.update", {
                id: "band-info",
                html: this.Template.BandInfo({
                    freq: "-",
                    signal: "-",
                    channel: "-"
                })
            });
        }
    }
}

module.exports = GraphPage;
