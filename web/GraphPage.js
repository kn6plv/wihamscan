const Graph = require("../Graph");
const BasePage = require("./BasePage");

class GraphPage extends BasePage {

    async cmd_init() {
        this.graphUpdated = this.graphUpdated.bind(this);

        this.graph = new Graph();
        this.graph.open();
        this.graph.on("update", this.graphUpdated);
    }

    async cmd_close() {
        this.graph.off("update", this.graphUpdated);
        this.graph.close();
    }

    async html() {
    }

    graphUpdated() {
        const points = this.graph.points;
        const len = points.length;
        const height = 400;
        const width = 800;
        const xscale = width / len;
        const yscale = height / 100;
        let d = `M 0 ${(100 - points[0]) * yscale} L`;
        for (let i = 1; i < len; i++) {
            d += ` ${i * xscale} ${(100 - points[i]) * yscale}`;
        }
        this.send("svg.path.update", {
            id: "graph-data-path",
            d: d
        });
    }
}

module.exports = GraphPage;
