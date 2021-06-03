const AnswerFinder = require('./AnswerFinder')
const { save, decimalToFrac, fracToDecimal, buildString, improperToMixed } = require('../utils')
const qs = require("querystring")

module.exports = class NsAnswerFinder extends AnswerFinder {

    base = "\\({i}\\)";
    startRegex = "";
    exceptionList = {};

    formatAnswer(question, i) {
        const qnum = i + 1;
        let str = this.strings[i].str;

        const combineDistance = .2;

        // Estimation questions
        if (qnum % 10 === 0) {
            // Clear any *(10) stuff left over
            str = str.slice(str.indexOf(")") + 1).trim();

            // Remove the dash since it shows up at the end usually (not actually a -, so just remove all non digits)
            const cleaned = str.replace(/\D/g, "");

            // The two numbers are combined together, same or 1 different number of digits, so just split string in half
            const len = cleaned.length;
            const first = cleaned.slice(0, len / 2); // If its a .5 it just rounds down
            const second = cleaned.slice(len / 2);

            // There are like 2 questions with negative ranges
            const negativeCount = (str.match(/-/g) || []).length;

            return [(negativeCount > 1 ? -1 : 1) * parseInt(first), (negativeCount > 1 ? -1 : 1) * parseInt(second)];
        }

        let isNegative = /[-−–]/g.test(str);

        // Get amount of answer chioces
        const choiceCount = (str.match(/,? *or|[,;]/g) || []).length + 1;

        // Split stuff based on heights
        let unfilterdHeights = question
            .filter(text => /[\d.]/.test(qs.unescape(text.R[0].T)))
            .map(text => text.y);
        // Remove duplicates and ones very close together
        let heights = [];
        for (const height of unfilterdHeights) {
            let shouldAdd = true;
            for (const included of heights) {
                // If already something close dont add
                if (Math.abs(height - included) < combineDistance) { shouldAdd = false; break; }
            }
            if (shouldAdd) heights.push(height);
        }
        heights.sort((a, b) => a - b);

        const sections = heights.map(height => question
            .filter(text => Math.abs(text.y - height) < combineDistance)
            .map(el => {
                let str = qs.unescape(el.R[0].T)
                // Clear any (1) stuff left over
                str = str.slice(str.indexOf(")") + 1).trim()

                // Remove any stuff left over thats not part of the answer
                str = str.replace(/[^\d.]/g, "")

                return str.trim()
            })
            .join("")
        ).filter(el => el); // Filter out the ones with nothing in them
        let answer;
        switch (choiceCount) {
            case 1: {
                switch (sections.length) {
                    case 1:
                        answer = sections[0];
                        break;
                    case 2:
                        answer = sections.join("/");
                        break;
                    case 3:
                        answer = `${sections[1]} ${sections[0]}/${sections[2]}`;
                        break;
                }
                // Add negatives
                answer = (isNegative ? "-" : "") + answer;
                break;
            }
            case 2:
            case 3:
                // A couple tests use commas in long numbers
                if (this.isWeird && sections.length === 1) {
                    return (isNegative ? "-" : "") + sections[0];
                }
                // Pain
                else if (this.isWeird && qnum === 39 && sections.length === 6) {
                    return [`${sections[0]}/${sections[2]}`, `${sections[4]} ${sections[3]}/${sections[5]}`, sections[1]];
                }
                else if (sections.length !== 3) return console.log(`Could not find fraction for ${qnum} on ${this.test.info.name}`, sections, heights);
                // Check if was (decimal, fraction) or (improper, mixed)
                {
                    const decimal = sections[1].match(/\.\d+/);
                    if (choiceCount == 2 && decimal) {
                        answer = [decimal[0], decimalToFrac(decimal[0])];
                        return answer.map(el => (isNegative ? "-" : "") + el);
                    }
                }

                const numerators = question.filter(text => Math.abs(text.y - heights[0]) < combineDistance);
                const denominatorT = question.find(text => Math.abs(text.y - heights[2]) < combineDistance);

                if (numerators.length !== 2) return console.log(`Could not find numerator for ${qnum} on ${this.test.info.name}`, sections, heights,
                    save("err/" + this.test.info.name + qnum, question));
                if (!denominatorT) return console.log(`Could not find denominator for ${qnum} on ${this.test.info.name}`, sections);

                const [numA, numB] = numerators.map(numerator => parseInt(numerator.R[0].T));
                const denominator = denominatorT.R[0].T;
                // Greater numerator belogns to improper
                const improper = `${numA > numB ? numA : numB}/${denominator}`;
                answer = [improper, improperToMixed(improper)];

                // Add decimal if was included
                if (choiceCount === 3) answer.push(fracToDecimal(improper));

                // Add negatbces if needed
                answer = answer.map(el => (isNegative ? "-" : "") + el);
                break;
            default:
                return console.error(`Too many choices detected for ${qnum} on ${this.test.info.name}`, str);
        }
        return answer;
    }
}