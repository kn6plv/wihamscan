const Log = require("debug")("wipryclarity");
const EventEmitter = require("events");
const { loadavg } = require("os");
const USB = require("usb");

const BAND_RSSI_2_4GHZ = 0;
const BAND_RSSI_5GHZ   = 1;
const BAND_RSSI_6E     = 2;

const BAND_HAM_22_26 = 3;
const BAND_HAM_32_36 = 4;
const BAND_HAM_55_63 = 5;

const VID = 0x26ae;
const PID = 0x000c;

const bands = {
    [BAND_RSSI_2_4GHZ]: {
        bandId: BAND_RSSI_2_4GHZ,
        minFreq: 2400,
        maxFreq: 2500,
        stepFreq: 100
    },
    [BAND_RSSI_5GHZ]: {
        bandId: BAND_RSSI_5GHZ,
        minFreq: 5145,
        maxFreq: 5860,
        stepFreq: 90
    },
    [BAND_RSSI_6E]: {
        bandId: BAND_RSSI_6E,
        minFreq: 5925,
        maxFreq: 7125,
        stepFreq: 100
    },
    [BAND_HAM_22_26]: {
        bandId: BAND_HAM_22_26,
        minFreq: 2200,
        maxFreq: 2600,
        stepFreq: 100
    },
    [BAND_HAM_32_36]: {
        bandId: BAND_HAM_32_36,
        minFreq: 3200,
        maxFreq: 3600,
        stepFreq: 100
    },
    [BAND_HAM_55_63]: {
        bandId: BAND_HAM_55_63,
        minFreq: 5500,
        maxFreq: 6300,
        stepFreq: 100
    },
};

class WiPryClarity extends EventEmitter {

    constructor() {
        super();

        this.device = USB.findByIds(VID, PID);
        if (!this.device) {
            throw new Error("No WiPryClarity device found");
        }
        this.opened = 0;
        this.config = null;
        this.band = null;
    }

    async open(band) {
        Log("open", band);
        this.opened++;
        if (this.opened === 1) {
            this.band = typeof band == "number" ? band : BAND_RSSI_5GHZ;
            await this._configure(bands[this.band]);
        }
        else if (this.config) {
            Log("reconnected", this.config);
            this.emit("connected", this.config);
        }
    }

    async close(force) {
        Log("close");
        if (--this.opened <= 0 || force) {
            this.opened = 0;
            await this._closeDevice();
        }
    }

    async changeBand(band) {
        if (band !== this.band) {
            this.band = band;
            await this._closeDevice();
            await this._configure(bands[this.band]);
        }
    }

    async _openDevice() {
        this.device.open(false);
        await new Promise(r => this.device.reset(r));
        await new Promise(r => this.device.setConfiguration(1, r));
        this.iface = this.device.interface(1);
        this.iface.claim();
        await new Promise(r => this.iface.setAltSetting(1, r));

        this.endpoint4 = this.iface.endpoint(4 + 128);
        this.endpoint3 = this.iface.endpoint(3);
    }

    async _closeDevice() {
        this.polling = false;
        while (this.running) {
            await new Promise(r => setTimeout(r, 1000));
        }
        if (this.iface) {
            await new Promise(r => this.iface.release(r));
            this.iface = null;
        }
        this.endpoint3 = null;
        this.endpoint4 = null;
        this.device.close();
    }

    async _configure(config) {
        // Setup the physical device
        for (;;) {
            try {
                await this._openDevice();
                break;
            }
            catch (_) {
                await this._closeDevice();
            }
        }
        
        this.info = await this._reset();
        await this._unknown_cmd1();
        await this._sweep(config);
        this.config = {
            minRssi: this.info.minRssi,
            maxRssi: this.info.maxRssi,
            maxRssi: Math.min(-40, this.info.maxRssi),
            noise: -95,
            minFreq: config.minFreq,
            maxFreq: config.maxFreq,
            samples: (config.maxFreq - config.minFreq) / config.stepFreq * 64,
            period: Math.ceil((config.maxFreq - config.minFreq) / config.stepFreq / 4) * 0.5
        };
        Log("connected", this.config);
        this.emit("opened");
        this.emit("connected", this.config);
        await this._start();
        this._poll();
    }

    async _poll() {
        this.polling = true;
        this.running = true;
        while (this.polling) {
            const buffer = await this._recv();
            if (buffer[0] === 0xAA && buffer[2] === this.band) {
                const data = new Float32Array(buffer.length - 4);
                const scale = (this.info.maxRssi - this.info.minRssi) / 256;
                for (let i = 4; i < buffer.length; i++) {
                    const rssi = this.info.minRssi + (this.info.maxRssi - this.info.minRssi) / 256 * buffer.readUInt8(i);
                    data[i - 4] = rssi;
                }
                this.emit("rssidata", 1, data);
            }
        }
        this.running = false;
    }

    async _reset() {
        Log("_reset");
        let count = 10;
        for (;;) {
            let done = false;
            let buffer = null;
            this.endpoint4.transfer(20000, (e, b) => {
                Log("_reset in:", e, b);
                buffer = b;
                done = true;
            });
            while (!done) {
                count++;
                if (count > 10) {
                    await this._send([ 0x03 ]);
                    count = 0;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            Log(buffer);
            if (buffer && buffer.length == 84 && buffer[0] == 0xaa) {
                Log("reset:", buffer.length, buffer);
                const info = {
                    productId: buffer.readUInt8(2),
                    versionNo: buffer.readUInt8(3),
                    candidate: buffer.readUInt8(4),
                    siliconId: buffer.toString("utf8", 8, 20),
                    maxRssi: buffer.readFloatBE(20),
                    minRssi: buffer.readFloatBE(24)
                };
                info.noise = info.minRssi + (info.maxRssi - info.minRssi) / 256 * buffer.readUInt32LE(32);
                Log(info);
                return info;
            }
        }
    }

    async _unknown_cmd1() {
        // This part appears fixed
        const cmd = [ 0x00, 0x00, 0xD8, 0xC2, 0x46, 0xBD, 0x24, 0xBD, 0xAE, 0x50 ];
        // Followed by what looks like 8 random values
        //for (let i = 0; i < 8; i++) {
        //    cmd.push(Math.round(Math.random() * 255))
        //}
        cmd.push(0x09, 0x0D, 0xD5, 0x08, 0x77, 0xAB, 0x9B, 0x07); // ???
        await this._send(cmd);
        for (;;) {
            const buffer = await this._recv();
            if (buffer[0] == 0xAA && buffer[1] == 0x00 && buffer[2] == 0x53 && buffer[3] == 0x00) {
                return true;
            }
        }
        return false;
    }

    async _sweep(config) {
        const options = {
            "5": {
                x: 0x00,
                a: 0x40,
                b: 0xBC,
                c: 0x1F,
                d: 0x0A,
            },
            "2_4": {
                x: 0x01,
                a: 0x00,
                b: 0xEE,
                c: 0x2F,
                d: 0x10,
            }
        };
        const o = config.minFreq < 2500 ?  options["2_4"] : options["5"];
        const cmd = [ config.stepFreq == 100 ? 0x02 : 0x01 ];
        let count = 0;
        for (let freq = config.minFreq; count < 16 && freq < config.maxFreq; count++, freq += config.stepFreq) {
            const f = freq - 800;
            cmd.push(
                o.x, o.a, 0x00, 0xEC, 0xC4, 0x1E, o.b, 0x23, 0x03, 0x7A, o.c, 0x00, 0x07, 0x00, 0x03, o.d, 0x00, 0x00, (f >> 8) & 0xFF, f & 0xFF, 0x00, 0x00, 0x00, 0x00
            );
        }
        const total = count;
        for (; count < 16; count++) {
            cmd.push(
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            );
        }
        cmd.push(
            Math.ceil(total / 4), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, config.bandId, total, 0x53
        );
        await this._send(cmd);
        await this._recv();
    }

    async _start() {
        await this._send([ 0x05 ]);
        for (;;) {
            const buffer = await this._recv();
            if (buffer[0] == 0xAA && buffer[1] == 0xA1 && buffer[2] == 0x01 && buffer[3] == 0x00) {
                return true;
            }
        }
        return false;
    }

    async _send(cmd) {
        if (cmd.length < 126) {
            cmd.unshift(cmd.length + 2);
        }
        else {
            // Dont yet understand the encoding scheme for larger payloads
            if (cmd.length == 397) {
                cmd.unshift(0x02);
                cmd.unshift(0x90);
            }
            else {
                throw new Error();
            }
        }
        cmd.unshift(0xAA);
        cmd = Buffer.from(Uint8Array.from(cmd));
        Log("_send:", cmd);
        const e = await new Promise(r => this.endpoint3.transfer(cmd, r));
        Log("_send: e: ", e);
    }

    async _recv() {
        return new Promise((resolve, reject) => {
            this.endpoint4.transfer(20000, (e, b) => {
                Log("_recv:", e, b);
                if (e || b[0] !== 0xAA) {
                    reject(e || new Error("Bad packet format"));
                }
                else {
                    resolve(b);
                }
            });
        });
    }
}

module.exports = new WiPryClarity();
