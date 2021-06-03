const AnswerFinder = require('./AnswerFinder')
const qs = require("querystring")

module.exports = class CaAnswerFinder extends AnswerFinder {
    base = "{i}\\s*=";
    exceptionList = {
        "MSCA STATE 18-19, 26": ["misexponent"],
        "ELCA2 20-21, 48": ["misx"]
    };

    // Overide for normal findstarts method
    findStarts() {
        // Find where all the questions start
        const name = this.test.info.name;

        let indexes = [];
        let currPage = 0;

        const maxPage = this.PAGES.length - 1;

        if (this.test.info.level !== "High") {
            let splitPage = this.combined[currPage].str.split("=");
            for (let i = 1; i <= this.test.info.grading.length; i++) {
                let strIndex = 0
                let prevIndex = splitPage.findIndex(str => {
                    strIndex += str.length + 1;
                    str = str.trim();
                    // Ends with qnum and make sure its not just in a number
                    return (
                        str.endsWith(i)
                        && (/[^\d.-]/.test(str))
                        // Make sure there is nothing earlier already found
                        && !indexes.find(index => index.page === currPage
                            && index.index > this.combined[currPage].indexMap[strIndex])
                    );
                });

                if (prevIndex < 0) {
                    currPage++;
                    // If would put on invalid page something is wrong
                    if (currPage > maxPage) return console.error("Could not find " + i + " for " + name);

                    splitPage = this.combined[currPage].str.split("=");
                    strIndex = 0;
                    // Find on next page using base
                    prevIndex = splitPage.findIndex(str => {
                        strIndex += str.length + 1;
                        str = str.trim();
                        // Ends with qnum and make sure its not just in a number
                        return (
                            str.endsWith(i)
                            && (/[^\d.]/.test(str))
                        );
                    });

                    // If still cant find something went wrong
                    if (prevIndex < 0) return console.error("Could not find " + i + " for " + name);
                }

                indexes.push({ page: currPage, index: this.combined[currPage].indexMap[strIndex] });
            }

        }
        else {
            while (currPage <= maxPage) {
                const page = this.combined[currPage];
                let match = null;
                const regex = /\d{2}\w-(?<qnum>\d+)\s*=/g;
                const matches = [];
                while (match = regex.exec(page.str)) matches.push(match);

                for (const match of matches) {
                    indexes.push({
                        page: currPage,
                        index: this.combined[currPage].indexMap[match.index + match[0].length],
                        qnum: parseInt(match.groups.qnum)
                    });
                }
                currPage++;
            }

            // Overwrite splitByIndexes to work with out of order questions
            // console.log(indexes)
            this.splitByIndexes = (data, indexes) => {
                if (indexes.length === 0) return data;
                const splits = []
                for (let i = 0; i < indexes.length; i++) {
                    const { index, page = 0, qnum } = indexes[i];
                    // If at end of array next will be undefined which includes the rest
                    let { index: nextIndex, page: nextPage } = indexes[i + 1] ?? {};

                    // If next is on next page, set next to undefined which includes the rest
                    if (nextPage > page) nextIndex = undefined;

                    // Slice based on index and nest and append
                    splits.push({ data: data[page].slice(index, nextIndex), qnum });
                }
                return splits.sort((a, b) => a.qnum - b.qnum).map(split => split.data);
            }

        }
        return indexes;
    }

    formatAnswer(question, i) {
        const qnum = i + 1;
        const exception = this.exceptionList[this.test.info.name + ", " + qnum];

        let texts = question.map(text => qs.unescape(text.R[0].T)
            .replace(/ /g, "")
            .replace(/[−–]/g, "-")
            .replace(/o/g, "0")
            .replace(/[×x]/g, "x")
            .toLowerCase());
        let text = texts.join("");

        if (text.includes("int") || text.includes("$")) {
            // Remove start of next question if nesccicary
            if (this.test.info.level !== "Middle") {
                if (text.includes("int")) {
                    text = text.split("int")[0];
                }
                else {
                    const index = texts.findIndex(str => /\d{2}[A-Za-z]/.test(str));
                    if (index > -1) {
                        text = texts.slice(0, index).join("");
                    }
                }
            }
            else {
                // Remove next qnum from end
                text = text.replace(new RegExp(`${qnum + 1}$`), "");
            }
            return { base: parseFloat(text.replace(/[^\d\.]/g, "")) };
        }
        else if (text.includes("llaranswer")) {
            return { base: parseFloat(text.split('d')[0]) };
        }
        // Significant digit problems
        else if (/\(\dsd\)/gi.test(text)) {
            const sd = /\((?<sd>\d)sd/i.exec(text)?.groups?.sd;
            return { base: parseFloat(text.split("(")[0]), sd: parseInt(sd) };
        }

        if (qnum === 70) debugger;
        // Some questions on some tests have different formatting
        if (this.test.info.level === "High" && !text.includes("x10")) {
            // Find start of next question
            const endIndex = texts.findIndex(str => /\d{2}[A-Za-z]/.test(str));
            // Find engativse
            const negatives = [];
            for (let i = 0; i < endIndex; i++) {
                const str = texts[i];
                if (str === "-") negatives.push(i);
            }
            // If 2 negatives found base and exponent are both negative
            let negativeBase = (negatives.length === 2),
                negativeExponent = (negatives.length === 2);
            // If only one deterimine if it was exponent or base
            if (negatives.length === 1) {
                // Get top of everything before it
                const top = Math.min(...question.slice(0, endIndex).map(t => t.y));
                // If at the top (or very close) it was in exponent, else in base
                if (Math.abs(question[negatives[0]].y - top) < .05) negativeExponent = true;
                else negativeBase = true;

            }
            // Get base and exponent from string
            const { base, exponent } = /(?<exponent>\d+)(?<base>\d\.\d{2})/.exec(text)?.groups ?? {};
            if (!base || !exponent) return console.error(`Could not parse question for ${qnum} on ${this.test.info.name}`, texts, text);
            return {
                base: (negativeBase ? -1 : 1) * parseFloat(base),
                exponent: (negativeExponent ? -1 : 1) * parseInt(exponent)
            };
        }

        // Find the exponent
        const search = exception?.[0] === "misx" ? "10" : "x10";
        let x10Index = text.indexOf(search);
        let x10ArrIndex = texts.findIndex(text => text.includes(search));
        if (x10Index < 0) return console.error(`Could not find x10 for ${qnum} on ${this.test.info.name}`, texts, text);
        // If cant find x10 in array was probably split
        if (x10ArrIndex < 0) x10ArrIndex = texts.findIndex(text => text.includes('x')) + 1;

        // If next qnum got included remove
        if (text.endsWith((qnum + 1) + "=")) text = text.slice(0, text.length - (qnum.toString().length + 1));

        // Get out base and exponent, and find any negatives
        const base = text.slice(x10Index - 4, x10Index);
        const negativeBase = text[x10Index - 5] === "-";
        let exponent = texts[x10ArrIndex + 1];
        if (exponent === "-") exponent += texts[x10ArrIndex + 2];
        if (exception?.[0] === "misexponent") {
            exponent = "1";
        }
        // On those weird tests the exponent is sometimes of the form 123,456
        if (this.isWeird) exponent = exponent.replace(/,/g, "");

        if (/[^\d.]/.test(base)) return console.error(`Error in base for ${qnum} on ${this.test.info.name}`, base, texts, text);
        if (/[^\d-]/.test(exponent)) return console.error(`Error in exponent for ${qnum} on ${this.test.info.name}`, exponent, texts, text);

        return { base: parseFloat(base) * (negativeBase ? -1 : 1), exponent: parseInt(exponent) };
    }

}