#! /usr/bin/env node

process.on("uncaughtException", e => {
    console.error("uncaughtException:");
    console.error(e)
});
process.on("unhandledRejection", e => {
    console.error("unhandledRejection:");
    console.error(e)
});

process.on("SIGTERM", async () => {
    process.exit();
});

const WiPryClarity = require("./WiPryClarity");
WiPryClarity.open();

require("./web/Web").run();
