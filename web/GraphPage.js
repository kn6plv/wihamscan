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
        this.pointUpdated();
    }

    async html() {
    }

    graphUpdated() {
        const points = this.graph.points;
        const len = points.length;
        const xscale = width / len;
        const yscale = height / 100;
        let d = `M 0 ${height} L 0 ${(98 - points[0]) * yscale}`;
        for (let i = 1; i < len; i++) {
            d += ` ${i * xscale} ${(98 - points[i]) * yscale}`;
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
            const p = points[Math.floor(this.cursor.x / width * points.length)];
            const dbi = p / 100 * (config.maxRssi - config.noise) + config.noise;
            const mhz = Math.round(this.cursor.x / width * (config.maxFreq - config.minFreq) + config.minFreq)
            this.send("html.update", {
                id: "band-info",
                html: this.Template.BandInfo({
                    freq: mhz,
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
