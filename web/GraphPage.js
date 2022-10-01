const Graph = require("../Graph");
const BasePage = require("./BasePage");

const height = 400;
const width = 800;


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
            t: this.graph.config.period
        });
        this.pointUpdated();
    }

    pointUpdated() {
        const config = this.graph.config;
        const points = this.graph.points;
        if (typeof this.cursor.x === "number" && config && points) {
            const scale = (config.maxFreq - config.minFreq) / width;
            const centerMHz = Math.round(this.cursor.x * scale + config.minFreq);
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
                })
            });
        }
        else {
            this.send("html.update", {
                id: "band-info",
                html: this.Template.BandInfo({
                    freq: "-",
                    signal: "-",
                })
            });
        }
    }
}

module.exports = GraphPage;
