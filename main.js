const { app, BrowserWindow } = require('electron');
const WiPryClarity = require("./WiPryClarity");
const Web = require("./web/Web");

WiPryClarity.open();
Web.open();

let win;

WiPryClarity.on("opened", () => {
    if (win) {
        win.reload();
    }
});

const createWindow = () => {
    win = new BrowserWindow({
        width: 1000,
        height: 680,
        resizable: false
    });

    win.loadURL("http://localhost:8080/");
};

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    WiPryClarity.close();
    Web.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
    process.exit();
});
