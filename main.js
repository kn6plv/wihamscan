const WebConfig = require("./web/Config");
const { app, BrowserWindow } = require('electron');
const WiPryClarity = require("./WiPryClarity");
const Web = require("./web/Web");
const Config = require("./web/Config");

let address = {};
let win;

Web.open(0).then(a => {
    address = a;
    if (win) {
        win.reload();
    }
});

WiPryClarity.on("opened", () => {
    if (win) {
        win.reload();
    }
});
WiPryClarity.open(WiPryClarity.BAND_5GHZ);

const createWindow = () => {
    win = new BrowserWindow({
        backgroundColor: 'black',
        width: 200 + Config.width,
        height: 75 + Config.graphHeight + Config.waterHeight,
        resizable: false
    });

    win.loadURL(`http://localhost:${address.port}/`);
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', async () => {
    await WiPryClarity.close(true);
    Web.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
    process.exit();
});
