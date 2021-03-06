const { getTexts, buildString, splitByIndexes, save } = require("../utils")

module.exports = class Finder {
    constructor(data, test, isQuestions, isWeird) {
        this.data = data;
        this.test = test;
        this.isQuestions = isQuestions;
        this.isWeird = isWeird;

        this.PAGES = test.info.pages[isQuestions ? "test" : "key"];

        this.height = data.formImage.Pages[0].Height;
        this.width = data.formImage.Width;

        this.texts = getTexts(this.data, this.PAGES);
        this.combined = buildString(this.texts, this.PAGES);

        if (TESTING) {
            save("combined", this.combined);
        }
    }

    formatCoordinates(top, left, right, bottom) {
        const PADDING = [1, 1, 1, 1];

        // Convert to percentages
        const hscale = this.width / 100;
        const vscale = this.height / 100;
        top /= vscale; bottom /= vscale;
        left /= hscale; right /= hscale;

        // Move orgin to bottom
        top = 100 - top;
        bottom = 100 - bottom;

        // Apply padding
        top += PADDING[0];
        left -= PADDING[1];
        bottom += PADDING[2];
        right -= PADDING[3];


        return [
            { x: left, y: top },
            { x: right, y: bottom }
        ];
    }

    findPageSplits(indexes) {
        const pages = [];
        for (let i = 1; i < this.PAGES.length; i++) {
            pages.push(indexes.findIndex(index => index.page === i));
        }
        return pages;
    }

    findTopLefts(questions, pageSplits, height) {
        return questions.map((question, i) => {
            // For last question on each page, filter out the ones that dont make sense
            if (pageSplits.includes(i - 1) || i === questions.length - 1) question = question.filter(text => text.y > height * .75);

            const top = Math.min(...question.map(text => text.y));
            const left = Math.min(...question.map(text => text.x));
            return {
                question: i + 1,
                top, left
            };
        });
    }

    run() {
        this.exceptions = Object.keys(this.exceptionList ?? {}).filter(key => key.startsWith(this.test.info.name));

        this.hasException = this.exceptions.length > 0;
        this.exceptionNums = this.exceptions.map(exception => parseInt(exception.split(" ").slice(-1)[0]));

        this.indexes = this.findStarts();
        if (!this.indexes) {
            return console.error("Could not find all indexes for test " + this.test.info.name);
        }
        // Some finders need to define a custom question creation function
        if (!this.questions) this.questions = splitByIndexes(this.texts, this.indexes);
    }
}