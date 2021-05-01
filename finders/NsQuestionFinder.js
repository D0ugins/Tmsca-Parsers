const { save } = require("../utils");
const Finder = require("./Finder")

const exceptionList = {
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
}

const startRegex = (
    "([\s_]" +  // Previous is whitespace or underscore
    "|\\D\\)?" + // Previous is word (ex. fraction, mixed number), can have )
    "|(?<=\\))[^\\)]+)" + // If there was underscore before last question num

    "\\**"  // Can have *
).replace(/\\/g, "\\");

const base = "\\({i}\\)"

module.exports = class NsQuestionFinder extends Finder {
    constructor(data, test) {
        super(data, test, true);
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
        super.run(base, startRegex, exceptionList)
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
