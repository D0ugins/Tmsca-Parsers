const { save } = require("../utils");
const QuestionFinder = require("./QuestionFinder")

const exceptionList = {
    "MSNS KO 20-21, 34": ["startParenth"],
    "MSNS6 20-21, 34": ["startParenth"],
    "MSNS7 20-21, 34": ["startParenth"],
    "MSNS8 20-21, 34": ["startParenth"],
    "MSNS9 20-21, 34": ["startParenth"],
    "MSNS10 20-21, 34": ["startParenth"],
    "MSNS12 20-21, 34": ["startParenth"],
    "MSNS13 20-21, 34": ["startParenth"],
}

module.exports = class NsFinder extends QuestionFinder {
    constructor(data, test) {
        super(data, test);
    }

    findCol(start, end) {
        // If the next one is higher up must have started new column
        for (let i = start; i < end; i++) {
            if (this.toplefts[i].top > this.toplefts[i + 1].top) return i + 1;
        }
    }

    findStarts() {
        // Find where all the questions start
        this.indexes = [];
        let currPage = 0;
        const maxPage = this.PAGES.length - 1;
        const exceptions = Object.keys(exceptionList).filter(key => key.startsWith(this.test.info.name))

        const hasException = exceptions.length > 0;
        const exceptionNums = exceptions.map(exception => parseInt(exception.split(" ").slice(-1)[0]));

        for (let i = 1; i <= 80; i++) {
            const str = this.combined[currPage].str;
            // Find the question in the combined string
            let index = 0;

            if (hasException && exceptionNums.includes(i)) {
                // console.log(`${this.test.info.name}, ${i}`, exceptionList[`${this.test.info.name}, ${i}`])
                switch (exceptionList[`${this.test.info.name}, ${i}`][0]) {
                    case "startParenth":
                        const index = str.indexOf(i + ")");
                        this.indexes.push({ page: currPage, index: this.combined[currPage].indexMap[index] });
                        break;
                    default:
                        return console.error("Invalid exception type for " + this.test.info.name + " " + i);
                }
                continue;
            }
            if (i === 1) index = str.indexOf("(1)");
            else {
                // For all questions except the first, make sure its actually the question and not inside a problem 
                index = str.search(new RegExp(
                    "([\s_]" +  // Previous is whitespace or underscore
                    "|base \\d+" +  // Previous is "base n"
                    "|\\D\\)?" + // Previous is word (ex. fraction, mixed number), can have )
                    "|_\\d+|" + // Previous is just base number,
                    "[a-zA-Z]|)" + // Previous is unit to a power
                    "\\**\\" + // Can have *
                    `(${i}\\)` // Has (qnum)
                ));
                // Remove all the stuff detected at start
                index += str.slice(index).indexOf("(");
            }

            // If cant find probably on next page
            if (index === -2) {
                currPage++;
                // If would put on invalid page something is wrong
                if (currPage > maxPage) return console.error("Could not find " + i + " for " + this.test.info.name);

                // Find on next page
                index = this.combined[currPage].str.indexOf(`(${i})`);

                // If still cant find something went wrong
                if (index === -1) return console.error("Could not find " + i + " for " + this.test.info.name);
            }
            // Get index of the text object that corresponds with that part of the combined string
            this.indexes.push({ page: currPage, index: this.combined[currPage].indexMap[index] });
        }
    }

    findTopLefts() {
        this.toplefts = this.questions.map((question, i) => {
            // For last question on each page, filter out the ones that dont make sense
            if (i === this.pageSplit - 1 || i === 79) question = question.filter(text => text.y > this.height * .75);

            const top = Math.min(...question.map(text => text.y));
            const left = Math.min(...question.map(text => text.x));
            return {
                question: i + 1,
                top, left
            };
        });
    }

    findColLefts() {
        this.colSplits = [
            this.findCol(0, this.pageSplit),
            this.findCol(this.pageSplit, 80)
        ];
        this.colLefts = [
            Math.min(...this.toplefts.slice(this.colSplits[0], this.pageSplit).map(el => el.left)),
            Math.min(...this.toplefts.slice(this.colSplits[1]).map(el => el.left))
        ];
    }

    calcBoundingBoxes() {

        this.boundingBoxes = []
        for (let i = 0; i < 80; i++) {
            const page = i >= this.pageSplit ? 1 : 0;
            const column = i >= this.colSplits[page] ? 1 : 0;

            // Get top and left from before
            let { top, left } = this.toplefts[i];
            // If in second column, use width of doc, else use the furthest left point of second column
            let right = column === 1 ? this.width : this.colLefts[page];
            // If end of page use page height, else get top of next one
            let bottom = i === this.pageSplit - 1 || i === 79 ? this.height
                : this.toplefts[i + 1].top;

            // pdf has orgin top left so to orgin to bttom subtract cords from 100
            this.boundingBoxes.push({
                page: page,
                coords: this.formatCoordinates(top, left, right, bottom)
            });
        }
    }

    run() {
        this.findStarts();
        if (this.indexes.length !== this.test.info.grading.length) {
            save("err/" + this.test.info.name, this.combined);
            return console.error("Could not find all questions for " + this.test.info.name);
        }
        this.questions = this.splitByIndexes(this.getTexts(this.data, ...this.PAGES), this.indexes);
        this.pageSplit = this.indexes.findIndex(index => index.page === 1);
        this.findTopLefts();
        this.findColLefts();
        this.calcBoundingBoxes();

        return this.boundingBoxes;
    }
}
