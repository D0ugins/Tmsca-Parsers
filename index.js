
const glob = require("glob");

const TestParser = require("./TestParser")
const { save } = require("./utils.js");

const TESTING = true

const parseTest = test_path => {
    const parser = new TestParser(test_path);
    return parser.run(true);
}

!TESTING ? (
    glob("./tests/**/*.pdf", (err, paths) => {
        if (err) throw err;

        for (const test_path of paths) {
            if (!test_path.includes("Number Sense")) continue;

            parseTest(test_path)
        }
    })
) : (
    parseTest("./tests/Middle/Number Sense/Number Sense 20-21/MSNS1 20-21.pdf")
)



