const BasePage = require("./BasePage");
const GraphPage = require("./GraphPage");
const WaterfallPage = require("./WaterfallPage");
const WiPryClarity = require("../WiPryClarity");

const width = 800;
const height = 400;
const wheight = 200;


class MainPage extends BasePage {

    async cmd_init() {
        this.graph = new GraphPage(this.state);
        this.waterfall = new WaterfallPage(this.state);

        await this.graph.cmd_init();
        await this.waterfall.cmd_init();
    }

    async cmd_close() {
        await this.graph.cmd_close();
        await this.waterfall.cmd_close();
    }

    async html() {

        let grid = "";
        let wgrid = "";

        const config = WiPryClarity.config;
        if (config) {

            const minFreq = config.minFreq;
            const maxFreq = config.maxFreq;
            const xscale = width / (maxFreq - minFreq);

            for (let f = Math.ceil(minFreq / 10) * 10; f < maxFreq; f += 10) {
                const x = (f - minFreq) * xscale;
                grid += ` M ${x} ${height} V 0`;
                wgrid += ` M ${x} ${wheight} V 0`;
            }

            const minRssi = config.minRssi;
            const maxRssi = config.maxRssi;
            const yscale = height / (maxRssi - minRssi);

            for (let r = Math.ceil(minRssi / 10) * 10; r < maxRssi; r += 10) {
                const y = (r - minRssi) * yscale;
                grid += ` M ${width} ${y} H 0`;
            }
        }

        return this.Template.MainPage({
            width: width,
            graph_height: height,
            waterfall_height: wheight,
            graph_grid: grid,
            waterfall_grid: wgrid
        });
    }
}

module.exports = MainPage;
