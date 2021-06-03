const { getTexts, buildString, save } = require("../utils")

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

    findStarts() {
        // Find where all the questions start
        const name = this.test.info.name;

        let indexes = [];
        let currPage = 0;
        const maxPage = this.PAGES.length - 1;

        for (let i = 1; i <= this.test.info.grading.length; i++) {
            const str = this.combined[currPage].str;
            const search = this.base.replace("{i}", i);

            // Handle tests with messed up formatting
            if (this.hasException && this.exceptionNums.includes(i)) {
                switch (this.exceptionList[`${name}, ${i}`][0]) {
                    case "startParenth":
                        const index = str.indexOf(i + ")");
                        indexes.push({ page: currPage, index: this.combined[currPage].indexMap[index] });
                        break;
                    default:
                        return console.error("Invalid exception type for " + name + " " + i);
                }
                continue;
            }

            // If first question, ignore stuff before
            const r = (i === 1 ? "" : this.startRegex) + search;
            let index = str.search(new RegExp(r));

            // Account for all the stuff detected at start
            index += str.slice(index).indexOf("(");

            // If cant find probably on next page
            if (index < 0) {
                currPage++;
                // If would put on invalid page something is wrong
                if (currPage > maxPage) return console.error("Could not find " + i + " for " + name);

                // Find on next page using base
                index = this.combined[currPage].str.search(new RegExp(search));

                // If still cant find something went wrong
                if (index < 0) return console.error("Could not find " + i + " for " + name);
            }
            // Get index of the text object that corresponds with that part of the combined string
            indexes.push({ page: currPage, index: this.combined[currPage].indexMap[index] });
        }
        return indexes;
    }

    // Needs to be overwritten by some test formats so define here instead
    splitByIndexes(data, indexes) {
        if (indexes.length === 0) return data;
        const splits = []
        for (let i = 0; i < indexes.length; i++) {
            const { index, page = 0 } = indexes[i];
            // If at end of array next will be undefined which includes the rest
            let { index: nextIndex, page: nextPage } = indexes[i + 1] ?? {};

            // If next is on next page, set next to undefined which includes the rest
            if (nextPage > page) nextIndex = undefined;

            // Slice based on index and nest and append
            splits.push(data[page].slice(index, nextIndex));
        }
        return splits;
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
        if (!this.questions) this.questions = this.splitByIndexes(this.texts, this.indexes);
    }
}