
const Log = require("debug")("web");

const Koa = require("koa");
const KoaCompress = require("koa-compress");
const Websockify = require("koa-websocket");
const Router = require("koa-router");
const Pages = require("./Pages");

// Web port
const webport = parseInt(process.env.PORT || 8080);

const Web = {

    run() {
        Log("running:");
        const Web = Websockify(new Koa());
        Web.on("error", err => console.error(err));

        const root = Router();
        const wsroot = Router();

        Pages(root, wsroot);

        Web.use(KoaCompress());
        Web.use(root.middleware());
        Web.ws.use(wsroot.middleware());
        Web.ws.use(async (ctx, next) => {
        await next(ctx);
        if (ctx.websocket.listenerCount("message") === 0) {
            ctx.websocket.close();
        }
        });
        Web.listen({
            host: "0.0.0.0",
            port: webport
        });
    }

}

module.exports = Web;

