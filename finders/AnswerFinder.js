const Finder = require('./Finder')
const { save, weirdTests, decimalToFrac, fracToDecimal, buildString, improperToMixed } = require('../utils')
const qs = require("querystring")


module.exports = class AnswerFinder extends Finder {
    constructor(data, test) {
        super(data, test, false)
    }

    cleanAnswers() {
        let strings = buildString(this.questions)

        // Clear stuff at start of each answer
        this.questions = this.questions.map((question, i) => {
            const str = strings[i].str
            // Get end of (1) section
            let index = str.indexOf(this.base.trim().slice(-1)) + 1
            // Get end of whitespace
            index += str.slice(index).length - str.slice(index).trimStart().length
            // Remove copyright stuff at end on last question
            let endIndex;
            if (i === this.test.info.grading.length - 1) {
                endIndex = question.findIndex(text => (text.y < 10 || text.R[0].T.includes("Copyright")));
                if (endIndex < 0) endIndex = undefined
            }

            return question.slice(strings[i].indexMap[index], endIndex)
        })
        return buildString(this.questions)
    }

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