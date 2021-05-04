const path = require("path")
const fs = require("fs")
const mkdirp = require("mkdirp");
const qs = require("querystring")
const Test = require("./Test");

const NsQuestionFinder = require("./finders/NsQuestionFinder");
const NsAnswerFinder = require("./finders/NsAnswerFinder");
const CaAnswerFinder = require("./finders/CaAnswerFinder");

const { loadPdf, fixPdf, range, save } = require("./utils")

const outputPath = "./output/";

module.exports = class TestParser {

    constructor(pdfpath) {
        this.pdfpath = pdfpath
        // Create test object
        this.test = new Test(this.pdfpath.split("/").slice(2).join("/"));

        this.questionFinders = {
            "Number Sense": NsQuestionFinder
        }

        this.answerFinders = {
            "Number Sense": NsAnswerFinder,
            "Calculator": CaAnswerFinder
        }
    }

    saveTest(test) {
        mkdirp.sync(path.join(__dirname, outputPath, test.info.dir));

        const outPath = path.join(outputPath, test.info.path + ".json");
        console.log("Saving " + test.info.name)
        fs.writeFileSync(outPath, JSON.stringify(test, null, 4));
    }

    setPageInfo(test) {
        const pageCount = this.data.formImage.Pages.length;

        // Generate page info
        switch (test.info.type) {
            case "Number Sense":
                this.test.info.pages = {
                    test: [pageCount - 3, pageCount - 2], // 3rd and second to last
                    key: [pageCount - 1] // Last page
                }
                break;
            case "Calculator":
                this.test.info.pages = {
                    test: range(3, pageCount - 3),
                    key: [pageCount - 3, pageCount - 2]
                }
                break;
        }
    }

    async run(shouldSave) {
        // Get right finders based on type
        const questionFinder = this.questionFinders[this.test.info.type];
        const answerFinder = this.answerFinders[this.test.info.type];

        // Load pdf
        console.log("Loading " + this.test.info.name)
        this.data = await loadPdf(this.pdfpath)
        this.setPageInfo(this.test)
        await fixPdf(this.pdfpath, this.data, this.test.info.pages.key);

        // Run finders
        this.test.boundingBoxes = new questionFinder(this.data, this.test).run()
        this.test.answers = new answerFinder(this.data, this.test).run();

        shouldSave ? this.saveTest(this.test) : console.log(test)
        return 0;
    }
}