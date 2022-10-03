const Config = require("./Config");
const Waterfall = require("../Waterfall");
const BasePage = require("./BasePage");

const width = Config.width;


class WaterfallPage extends BasePage {

    async cmd_init() {
        this.waterfallUpdated = this.waterfallUpdated.bind(this);

        this.waterfall = new Waterfall();
        this.waterfall.open();
        this.waterfall.on("update", this.waterfallUpdated);
    }

    async cmd_close() {
        this.waterfall.off("update", this.waterfallUpdated);
        this.waterfall.close();
    }

    async html() {
    }

    waterfallUpdated() {
        const points = this.waterfall.points;
        const config = this.waterfall.config;
        const len = points.length;
        const xscale = width / len;
        let l = '';
        for (let i = 0; i < len; i++) {
            const p = points[i] - config.noise;
            const x = i * xscale;
            const c = `hsl(200,100%,${Math.min(100, 5 + p * p / 10)}%)`;
            l += `<line x1="${x}" y1="0" x2="${x + xscale}" y2="0" style="stroke:${c};" />`;
        }
        this.send("waterfall.update", {
            id: "waterfall-data-scroll",
            l: `<svg>${l}</svg>`,
            t: this.waterfall.period
        });
    }
}

module.exports = WaterfallPage;
