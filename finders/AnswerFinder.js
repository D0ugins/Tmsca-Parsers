const Finder = require('./Finder')
const { save, buildString } = require('../utils')
const qs = require("querystring")


module.exports = class AnswerFinder extends Finder {
    constructor(data, test, isWeird) {
        super(data, test, false, isWeird)
    }

    cleanAnswers() {
        let strings = buildString(this.questions)

        // Clear stuff at start of each answer
        this.questions = this.questions.map((question, i) => {
            const str = strings[i].str
            // Get end of (1) section
            let index = str.indexOf(this.regex.toString().trim().slice(-3, -2)) + 1
            // Get end of whitespace
            index += str.slice(index).length - str.slice(index).trimStart().length
            // Remove copyright stuff at end on last question
            let endIndex;
            if (i === this.test.info.grading.length - 1) {
                endIndex = question.findIndex(text => !this.isWeird && (text.y < 10 || text.R[0].T.includes("Copyright")));
                if (endIndex < 0) endIndex = undefined
            }

            return question.slice(strings[i].indexMap[index], endIndex)
        })
        return buildString(this.questions)
    }

    findStarts() {
        // Find where all the questions start
        let indexes = [];
        let currPage = 0;
        const maxPage = this.PAGES.length - 1;

        while (currPage <= maxPage) {
            const page = this.combined[currPage];
            let match = null;
            const matches = [];
            // Get all matches of regex on current page
            while (match = this.regex.exec(page.str)) matches.push(match);

            // For each match push to index array, include qnum in case out of order
            for (const match of matches) {
                indexes.push({
                    page: currPage,
                    index: this.combined[currPage].indexMap[match.index],
                    qnum: parseInt(match.groups.qnum)
                });
            }
            currPage++;
        }
        return indexes;
    }

    formatAnswer(question, i) { }

    run() {
        super.run();
        if (this.indexes?.length !== this.test.info.grading.length) {
            save("err/ans" + this.test.info.name, this.combined);
            return console.error("Could not find all answers for " + this.test.info.name);
        }
        if (TESTING) {
            save("questions", this.questions)
            save("strings", buildString(this.questions))
        }

        this.strings = this.cleanAnswers();
        if (TESTING) { save("cleaned", this.strings) }
        return this.questions.map((question, i) => this.formatAnswer(question, i))
    }
}