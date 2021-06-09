const { save } = require("../utils");
const Finder = require("./Finder")

module.exports = class NsQuestionFinder extends Finder {
    constructor(data, test, isWeird) {
        super(data, test, true, isWeird);
    }

    findCol(start, end) {
        // If the next one is higher up must have started new column
        for (let i = start; i < end; i++) {
            if (this.toplefts[i].top > this.toplefts[i + 1].top) return i + 1;
        }
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
        this.boundingBoxes = [];
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

    base = "\\({i}\\)";

    startRegex = (
        "([\s_]" +  // Previous is whitespace or underscore
        "|\\D\\)?" + // Previous is word (ex. fraction, mixed number), can have )
        "|(?<=\\))[^\\)]+)" + // If there was underscore before last question num

        "\\**"  // Can have *
    ).replace(/\\/g, "\\");

    exceptionList = {
        "MSNS KO 20-21, 34": ["startParenth"],
        "MSNS6 20-21, 34": ["startParenth"],
        "MSNS7 20-21, 34": ["startParenth"],
        "MSNS8 20-21, 34": ["startParenth"],
        "MSNS9 20-21, 34": ["startParenth"],
        "MSNS10 20-21, 34": ["startParenth"],
        "MSNS11 20-21, 34": ["startParenth"],
        "MSNS12 20-21, 34": ["startParenth"],
        "MSNS13 20-21, 34": ["startParenth"],
        "MSNS REG 20-21, 34": ["startParenth"],
        "MSNS TU 20-21, 34": ["startParenth"],
        "HSNS5 20-21, 34": ["startParenth"],
        "HSNS7 20-21, 34": ["startParenth"],
        "HSNS8 20-21, 19": ["startParenth"],
    };

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

    run() {
        super.run();
        if (this.indexes?.length !== this.test.info.grading.length) {
            save("err/ques" + this.test.info.name, this.combined);
            return console.error("Could not find all questions for " + this.test.info.name);
        }

        this.pageSplits = this.findPageSplits(this.indexes);
        this.toplefts = this.findTopLefts(this.questions, this.pageSplits, this.data.formImage.Pages[0].Height);

        this.findColLefts();
        this.calcBoundingBoxes();

        return this.boundingBoxes;
    }
}
