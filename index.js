
const glob = require("glob");

const TestParser = require("./TestParser")
const { save } = require("./utils.js");

glob("./tests/**/*.pdf", (err, paths) => {
    if (err) throw err;

    for (const test_path of paths) {
        if (!test_path.includes("Number Sense")) continue;

        const parser = new TestParser(test_path);
        parser.run(true);
    }
})
