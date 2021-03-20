const PDFParser = require("pdf2json");
const path = require("path")
const fs = require("fs")

const mkdirp = require("mkdirp");

const Test = require("./Test");
const NsFinder = require("./finders/NsFinder");

const outputPath = "./output";

module.exports = class TestParser {
    constructor(pdfpath) {
        this.pdfpath = pdfpath
        // Create test object
        this.test = new Test(this.pdfpath.split("/").slice(2).join("/"));

        this.finders = {
            "Number Sense": NsFinder
        }
    }

    saveTest() {
        mkdirp.sync(path.join(__dirname, outputPath, this.test.info.dir));

        const outPath = path.join(outputPath, this.test.info.path + ".json");
        console.log("Saving " + this.test.info.name)
        fs.writeFileSync(outPath, JSON.stringify(this.test, null, 4));
    }

    setPageInfo() {
        const pageCount = this.data.formImage.Pages.length;

        // Generate page info
        switch (this.test.info.type) {
            case "Number Sense":
                this.test.info.pages = {
                    test: [pageCount - 3, pageCount - 2], // 3rd and second to last
                    key: [pageCount - 1] // Last
                }
        }
    }

    run(save) {
        // Get right finder based on type
        const Finder = this.finders[this.test.info.type];
        if (!Finder) return;

        // Load pdf
        let parser = new PDFParser();
        parser.on("pdfParser_dataReady", data => {
            this.data = data
            // Update page data
            this.setPageInfo();

            // Create finder and run
            this.finder = new Finder(this.data, this.test)
            this.test.boundingBoxes = this.finder.run();

            save ? this.saveTest() : console.log(this.test);
        })
        console.log("Loading " + this.test.info.name)
        parser.loadPDF(this.pdfpath);
    }
}