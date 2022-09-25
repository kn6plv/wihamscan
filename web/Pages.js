
const Log = require("debug")("pages");
const FS = require("fs");

function F(page) {
    return {
        get: async (ctx) => {
            Log("get:", ctx);
            ctx.body = FS.readFileSync(page.path, { encoding: page.encoding || "utf8" });
            ctx.type = page.type;
        }
    };
}

const Main = require("./Main");
const Pages = {
    "/":                  { get: Main.HTML },
    "/ws":                { get: Main.WS },
    "/js/script.js":      F({ path: `${__dirname}/static/script.js`,  type: "text/javascript" }),
    "/css/general.css":   F({ path: `${__dirname}/static/general.css`, type: "text/css" }),
    "/css/main.css":      F({ path: `${__dirname}/static/main.css`, type: "text/css" })
};

function Register(root, wsroot) {

    for (let name in Pages) {
        if (name.endsWith("/ws")) {
             wsroot.get(name, Pages[name].get);
        }
        else {
            root.get(name, Pages[name].get);
        }
    }
  
  }  

module.exports = Register;
