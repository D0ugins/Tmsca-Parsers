const glob = require("glob");

const TestParser = require("./TestParser")
const { save } = require("./utils.js");

global.TESTING = false;
const testFolder = "./tests"

const parseTest = test_path => {
    const parser = new TestParser(test_path);
    return parser.run(true);
}
// Disable pdfjs warning message when loading broken fonts
const oldLog = console.log
console.log = (message, ...optionalArgs) => {
    if (message === "Warning: TT: undefined function: 32") return;
    oldLog(message, ...optionalArgs)
}

!TESTING ? (
    glob(testFolder + "/**/*.pdf", (err, paths) => {
        if (err) throw err;

        for (const test_path of paths) {
            if (!test_path.includes("Number Sense")) continue;
            parseTest(test_path)
        }
    })
) : (
    parseTest("./tests/Middle/Calculator/Calculator 20-21/MSCA1 20-21.pdf")
)
