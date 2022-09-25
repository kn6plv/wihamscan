
const Log = require("debug")("web:main");
const MainPage = require("./MainPage");

async function HTML(ctx) {
    Log("loading:");
    ctx.body = await new MainPage().html();
    ctx.type = "text/html";
}

async function WS(ctx) {

    const State = {
        page: null,

        send: function(cmd, value) {
            try {
                ctx.websocket.send(JSON.stringify({
                    cmd: cmd,
                    value: value
                }));
            }
            catch (e) {
                Log(e);
            }
        },

        update: async function() {
            this.send("html.update", {
                id: "info",
                html: await State.page.html()
            });
        }
    };

    const root = new MainPage();
    root.state = State;
    State.page = root;

    ctx.websocket.on('error', () => {
         ctx.websocket.close();
    });

    const q = [];
    const msgDispatch = async (data) => {
        try {
            const msg = JSON.parse(data);
            Log("msg", msg);
            const cmd = `cmd_${msg.cmd || "missing"}`;
            const dispatch = async () => {
                let fn = null;
                let ctx = State.page;
                if (ctx) {
                    fn = ctx[cmd];
                }
                if (!fn) {
                    ctx = null;
                    fn = State[cmd];
                }
                if (fn) {
                    q.push(async () => {
                        try {
                            Log("exec", msg);
                            await fn.call(ctx, msg);
                        }
                        catch (e) {
                            Log(e);
                        }
                    });
                    if (q.length === 1) {
                        while (q.length) {
                            await q[0]();
                            q.shift();
                        }
                    }
                }
            }
            await dispatch();
        }
        catch (e) {
            Log(e);
        }
    }
    ctx.websocket.on('message', msgDispatch);

    ctx.websocket.on('close', () => {
        msgDispatch('{ "cmd": "close" }');
    });
}

module.exports = {
    HTML: HTML,
    WS: WS
};
