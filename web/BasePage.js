
const Template = require("./Template");

Template.load();

class BasePage {

    Template = Template

    constructor(state) {
        this.state = state;
    }

    get name() {
        throw new Error("no name");
    }

    async init() {
    }

    send(cmd, value) {
        this.state.send(cmd, value);
    }
}

module.exports = BasePage;
