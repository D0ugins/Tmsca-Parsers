const path = require("path")
const fs = require("fs")
const mkdirp = require("mkdirp");

const Test = require("./Test");
const NsQuestionFinder = require("./finders/NsQuestionFinder");
const { loadPdf } = require("./utils")

const outputPath = "./output";

module.exports = class TestParser {

    constructor(pdfpath) {
        this.pdfpath = pdfpath
        // Create test object
        this.test = new Test(this.pdfpath.split("/").slice(2).join("/"));

        this.finders = {
            "Number Sense": NsQuestionFinder
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
                    key: [pageCount - 1] // Last
                }
        }
    }

    async run(shouldSave) {
        // Get right finder based on type
        const questionFinder = this.finders[this.test.info.type];
        if (!questionFinder) return;

        // Load pdf
        console.log("Loading " + this.test.info.name)
        this.data = await loadPdf(this.pdfpath)
        this.setPageInfo(this.test)

        // Run finder
        this.test.boundingBoxes = new questionFinder(this.data, this.test).run()

        shouldSave ? this.saveTest(this.test) : console.log(test)
        return 0;
    }
}