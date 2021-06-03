const path = require("path");

module.exports = class Test {
    constructor(pdfpath) {
        // Generate basic info
        const { name, dir } = path.parse(pdfpath);
        const pathArr = dir.split("/");
        this.info = {
            name,
            dir,
            path: dir + "/" + name,
            level: pathArr[0],
            type: pathArr[1],
            // Get year by getting the last secon of the /(type) (year)/ part of the path
            year: pathArr[2].split(" ").slice(-1)[0],
            // Get number by first removing the 4 character leveltype code at start, then remove the year
            number: name.slice(4).split(" ").slice(0, -1).join(" ")
        };

        // Generate grading info
        const { level, type } = this.info
        switch (type) {
            case "Number Sense":
                this.info.grading = {
                    prize: 5,
                    penalty: 4,
                    length: 80,
                    penalizeSkip: true
                };
                break;
            case "Calculator":
                this.info.grading = {
                    prize: 5,
                    penalty: level === "High" ? 2 : 4,
                    length: level === "High" ? 70 : 80,
                    penalizeSkip: true
                };
                break;
            case "Math":
            case "Science":
                this.info.grading = {
                    prize: level === "High" ? 6 : 5,
                    penalty: 2,
                    length: level === "High" ? 60 : 50,
                    penalizeSkip: false
                };
                break;
        }
    }
}