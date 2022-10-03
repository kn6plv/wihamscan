const WebConfig = require("./web/Config");
const { app, BrowserWindow } = require('electron');
const WiPryClarity = require("./WiPryClarity");
const Web = require("./web/Web");

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
WiPryClarity.open();

const createWindow = () => {
    win = new BrowserWindow({
        backgroundColor: 'black',
        width: 200 + WebConfig.width,
        height: 75 + WebConfig.graphHeight + WebConfig.waterHeight,
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
});
