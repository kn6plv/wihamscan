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

    async cmd_change_band(msg) {
        const band = msg.value.band;
        switch (band) {
            case WiPryClarity.BAND_2_4GHZ:
            case WiPryClarity.BAND_5GHZ:
            case WiPryClarity.BAND_6E:
                WiPryClarity.changeBand(band);
                break;
            default:
                break;
        }
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

        const config = WiPryClarity.config;
        if (config) {

            const minFreq = config.minFreq;
            const maxFreq = config.maxFreq;
            const xscale = width / (maxFreq - minFreq);

            for (let f = Math.ceil(minFreq / 20) * 20; f < maxFreq; f += 20) {
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
        });
    }
}

module.exports = MainPage;
