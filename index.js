const glob = require("glob");

const TestParser = require("./TestParser");
const { save } = require("./utils.js");

global.TESTING = true;
const testingTypes = ["Calc", "Number"];

const testFolder = "./tests/";

const parseTest = test_path => {
    const parser = new TestParser(test_path);
    return parser.run(true);
}
// Disable pdfjs warning message when loading broken fonts
const oldLog = console.log;
console.log = (message, ...optionalArgs) => {
    if (message === "Warning: TT: undefined function: 32") return;
    oldLog(message, ...optionalArgs);
}

!TESTING ? (
    glob(testFolder + "/**/*.pdf", (err, paths) => {
        if (err) throw err;

        for (const test_path of paths) {
            if (!testingTypes.find(type => test_path.includes(type))) continue;
            parseTest(test_path);
        }
    })
) : (
    parseTest("./tests/Middle/Number Sense/Number Sense 20-21/MSNS1 20-21.pdf")
)
