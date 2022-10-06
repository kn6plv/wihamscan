const Config = require("./Config");
const BasePage = require("./BasePage");
const GraphPage = require("./GraphPage");
const WaterfallPage = require("./WaterfallPage");
const WiPryClarity = require("../WiPryClarity");

const width = Config.width;
const height = Config.graphHeight;
const wheight = Config.waterHeight;


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

    async cmd_change_band(msg) {
        WiPryClarity.changeBand(msg.value.band);
    }

    async cmd_dispatch(msg) {
        let fn = this.graph[`cmd_${msg.cmd}`];
        if (fn) {
            await fn.call(this.graph, msg);
        }
        else {
            fn = this.waterfall[`cmd_${msg.cmd}`];
            if (fn) {
                await fn.call(this.waterfall, msg);
            }
        }
    }

    async html() {

        let grid = "";
        let wgrid = "";
        const htext = [];
        const vtext = [];
        let band = null;
        let xscale = 0;

        const config = WiPryClarity.config;
        if (config) {

            const minFreq = config.minFreq;
            const maxFreq = config.maxFreq;
            xscale = width / (maxFreq - minFreq);

            const step = xscale > 5 ? 10 : xscale > 1 ? 20 : 50;
            for (let f = Math.ceil(minFreq / step) * step; f < maxFreq; f += step) {
                const x = (f - minFreq) * xscale;
                grid += ` M ${x} ${height} V 0`;
                wgrid += ` M ${x} ${wheight} V 0`;
                vtext.push({
                    x: x,
                    t: `${f}`
                });
            }

            const minRssi = config.noise;
            const maxRssi = config.maxRssi;
            const yscale = height / (maxRssi - minRssi);

            for (let r = Math.ceil(minRssi / 10) * 10; r < maxRssi; r += 10) {
                const y = height - (r - minRssi) * yscale;
                grid += ` M ${width} ${y} H 0`;
                htext.push({
                    y: y + 9,
                    t: `${r}`
                });
            }

            band = WiPryClarity.band;
        }

        return this.Template.MainPage({
            width: width,
            graph_height: height,
            waterfall_height: wheight,
            graph_grid: grid,
            waterfall_grid: wgrid,
            graph_vtext: vtext,
            graph_htext: htext,
            band: band,
            freq: "-",
            signal: "-",
            channel: "-",
            xscale: xscale
        });
    }
}

module.exports = MainPage;
