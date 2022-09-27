
const Log = require("debug")("web");

const Koa = require("koa");
const KoaCompress = require("koa-compress");
const Websockify = require("koa-websocket");
const Router = require("koa-router");
const Pages = require("./Pages");

// Web port
const webport = parseInt(process.env.PORT || 8080);

const Web = {

    open() {
        Log("open");
        this.web = Websockify(new Koa());
        this.web.on("error", err => console.error(err));

        const root = Router();
        const wsroot = Router();

        Pages(root, wsroot);

        this.web.use(KoaCompress());
        this.web.use(root.middleware());
        this.web.ws.use(wsroot.middleware());
        this.web.ws.use(async (ctx, next) => {
        await next(ctx);
        if (ctx.websocket.listenerCount("message") === 0) {
            ctx.websocket.close();
        }
        });
        this.server = this.web.listen({
            host: "0.0.0.0",
            port: webport
        });
    },

    close() {
        Log("close");
        this.server.close();
    }

}

module.exports = Web;

