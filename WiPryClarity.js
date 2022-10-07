const Log = require("debug")("wipryclarity");
const EventEmitter = require("events");
const USB = require("usb");
const WiPryClarityAuth = null;//require("bindings")("WiPryClarity");

const BAND_RSSI_2_4GHZ = 0;
const BAND_RSSI_5GHZ   = 1;
const BAND_RSSI_6E     = 2;

const BAND_HAM_22_26 = 3;
const BAND_HAM_32_36 = 4;
const BAND_HAM_55_63 = 5;
const BAND_HAM_58_59 = 6;

const VID = 0x26ae;
const PID = 0x000c;

const bands = {
    [BAND_HAM_22_26]: {
        bandId: BAND_HAM_22_26,
        minFreq: 2200,
        maxFreq: 2650,
        stepFreq: 90,
        stepSamples: 64
    },
    [BAND_RSSI_2_4GHZ]: {
        bandId: BAND_RSSI_2_4GHZ,
        minFreq: 2400,
        maxFreq: 2490,
        stepFreq: 90,
        stepSamples: 256
    },
    [BAND_HAM_32_36]: {
        bandId: BAND_HAM_32_36,
        minFreq: 3200,
        maxFreq: 3650,
        stepFreq: 90,
        stepSamples: 64
    },
    [BAND_RSSI_5GHZ]: {
        bandId: BAND_RSSI_5GHZ,
        minFreq: 5145,
        maxFreq: 5865,
        stepFreq: 90,
        stepSamples: 64
    },
    [BAND_HAM_55_63]: {
        bandId: BAND_HAM_55_63,
        minFreq: 5500,
        maxFreq: 6310,
        stepFreq: 90,
        stepSamples: 64
    },
    [BAND_HAM_58_59]: {
        bandId: BAND_HAM_58_59,
        minFreq: 5850,
        maxFreq: 5940,
        stepFreq: 90,
        stepSamples: 256
    },
    [BAND_RSSI_6E]: {
        bandId: BAND_RSSI_6E,
        minFreq: 5925,
        maxFreq: 7185,
        stepFreq: 90,
        stepSamples: 64
    }
};
const BAND_DEFAULT = BAND_HAM_58_59;

class WiPryClarity extends EventEmitter {

    constructor() {
        super();
        this.device = null;
        this.opened = 0;
        this.config = null;
        this.band = null;
        this.first = true;
    }

    async open(band) {
        Log("open", band);
        this.opened++;
        if (!this.device) {
            this.device = USB.findByIds(VID, PID);
            if (!this.device) {
                throw new Error("No WiPryClarity device found");
            }
        }
        if (this.opened === 1) {
            this.band = band !== undefined ? band : BAND_DEFAULT;
            await this._configure(bands[this.band]);
        }
        else if (this.config) {
            Log("reconnected", this.config);
            this.emit("connected", this.config);
        }
    }

    async close(force) {
        Log("close");
        if (this.opened > 0) {
            this.opened--;
            if (this.opened === 0 || force) {
                await this._closeDevice();
                this.opened = 0;
            }
        }
    }

    async changeBand(band) {
        if (band !== this.band) {
            this.band = band;
            await this._closeDevice();
            await new Promise(r => setTimeout(r, 2000));
            await this._configure(bands[this.band]);
        }
    }

    getBands() {
        const b = [];
        for (let k in bands) {
            const band = bands[k];
            b.push({
                key: k,
                from: band.minFreq,
                to: band.maxFreq
            });
        }
        b.sort((a, b) => a.from - b.from);
        return b;
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
        if (this.first && WiPryClarityAuth) {
            this.first = false;
            const auth = new WiPryClarityAuth.MyMonitor();
            auth.open(0);
            await new Promise(r => setTimeout(r, 2000));
            auth.close();
        }
        for (;;) {
            try {
                await this._openDevice();
                this.info = await this._reset();
                if (this.first) {
                    this.first = false;
                    await this._authenticate();
                }
                await this._sweep(config);
                this.config = {
                    minRssi: this.info.minRssi,
                    maxRssi: this.info.maxRssi,
                    maxRssi: Math.min(-40, this.info.maxRssi),
                    noise: -95,
                    minFreq: config.minFreq,
                    maxFreq: config.maxFreq,
                    samples: (config.maxFreq - config.minFreq) / config.stepFreq * config.stepSamples
                };
                Log("connected", this.config);
                this.emit("opened");
                this.emit("connected", this.config);
                await this._start();
                this._poll();
                break;
            }
            catch (e) {
                Log(e);
                await this._closeDevice();
            }
        }
    }

    async _poll() {
        this.polling = true;
        this.running = true;
        while (this.polling) {
            try {
                const buffer = await this._recv();
                if (buffer[0] === 0xAA && buffer[2] === this.band) {
                    const data = new Float32Array(buffer.length - 4);
                    for (let i = 4; i < buffer.length; i++) {
                        const rssi = this.info.minRssi + (this.info.maxRssi - this.info.minRssi) / 256 * buffer.readUInt8(i);
                        data[i - 4] = rssi;
                    }
                    this.emit("rssidata", 1, data);
                }
            }
            catch (e) {
                Log(e);
            }
        }
        this.running = false;
    }

    async _reset() {
        Log("_reset");
        let count = 0;
        for (;;) {
            let done = false;
            let buffer = null;
            this.endpoint4.transfer(20000, (e, b) => {
                Log("_reset in:", e, b);
                buffer = b;
                done = true;
            });
            while (!done) {
                count--;
                if (count < 0) {
                    await this._send([ 0x03 ]);
                    count = 10;
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
                    minRssi: buffer.readFloatBE(24),
                    // The challenge is always the same after the device is first plugged in.
                    // Not sure if its contact or hardware keyed in some way
                    challenge: buffer.subarray(60, 68)
                };
                info.noise = info.minRssi + (info.maxRssi - info.minRssi) / 256 * buffer.readUInt32LE(32);
                Log(info);
                return info;
            }
            count = 0;
        }
    }

    async _authenticate() {
        // This is always the same
        const cmd = [ 0x00, 0x00, 0xD8, 0xC2, 0x46, 0xBD, 0x24, 0xBD, 0xAE, 0x50 ];
        // And this is always different.
        // It appears to be some sort of answer to the challenge issued when the device resets.
        // However, this value always works regardless of the challenge sent earlier.
        // It is probably tied to the hardware itself (silicon id maybe) but that's unknown and may
        // not work on other hardware.
        cmd.push(0xC1, 0x9C, 0x45, 0x75, 0x13, 0x49, 0x40, 0xD3);
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
            high: {
                b: 0xBC,
                c: 0x1F, // High nibble seems like some sort of dbi offset, low nibble ?
                d: 0x0A,
            },
            low: {
                b: 0xEE,
                c: 0x2F,
                d: 0x10,
            }
        };
        const o = config.minFreq < 2500 ? options.low : options.high;
        const cmd = [ config.stepFreq == 100 ? 0x02 : 0x01 ];
        let count = 0;
        for (let freq = config.minFreq; count < 16 && freq < config.maxFreq; count++, freq += config.stepFreq) {
            const f = freq - 800;
            cmd.push(
                (config.stepSamples >> 8) & 0xFF, config.stepSamples & 0xFF, 0x00, 0xEC, 0xC4, 0x1E, o.b, 0x23, 0x03, 0x7A, o.c, 0x00, 0x07, 0x00, 0x03, o.d, 0x00, 0x00, (f >> 8) & 0xFF, f & 0xFF, 0x00, 0x00, 0x00, 0x00
            );
        }
        const samples = count * config.stepSamples;
        const total = Math.ceil(count / 4) * 4;
        for (; count < 16; count++) {
            cmd.push(
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            );
        }
        cmd.push(
            (samples >> 8) & 0xFF, samples & 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, config.bandId, total, 0x53
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
        Log("_send:", cmd.toString("hex"));
        const e = await new Promise(r => this.endpoint3.transfer(cmd, r));
        Log("_send: e: ", e);
    }

    async _recv() {
        return new Promise((resolve, reject) => {
            this.endpoint4.transfer(20000, (e, b) => {
                Log("_recv:", e, b ? b.length : -1, b);
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
