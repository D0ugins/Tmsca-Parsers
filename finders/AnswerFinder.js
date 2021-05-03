const Finder = require('./Finder')
const { save, weirdTests, decimalToFrac, fracToDecimal, buildString, improperToMixed } = require('../utils')
const qs = require("querystring")


module.exports = class AnswerFinder extends Finder {
    constructor(data, test) {
        super(data, test, false)
    }

    cleanAnswers() { }

    formatAnswer(question, i) { }

    run() {
        super.run(this.base, "", {});
        this.isWeird = weirdTests.includes(this.test.info.name)
        if (this.indexes?.length !== this.test.info.grading.length) {
            save("err/ans" + this.test.info.name, this.combined);
            return console.error("Could not find all answers for " + this.test.info.name);
        }
        if (TESTING) {
            save("questions", this.questions)
            save("strings", buildString(this.questions))
        }
        this.strings = this.cleanAnswers();

        return this.questions.map((question, i) => this.formatAnswer(question, i))
    }
}