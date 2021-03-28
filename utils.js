const fs = require('fs')
const PDFParser = require("pdf2json");
const qs = require("querystring")

const save = (name, data) => fs.writeFileSync(`./json/${name}.json`, JSON.stringify(data ?? {}, null, 4))

const loadPdf = path => new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataReady", resolve)
    parser.loadPDF(path)
})

const getTexts = (data, pages) => pages.map(page => data.formImage.Pages[page].Texts)

const buildString = texts => texts.map(page => {
    let str = "";
    let indexMap = []
    for (const i in page) {
        const s = qs.unescape(page[i].R[0].T);
        // Add text to string
        str += s
        // The next s.length entires in the index array are the current index
        indexMap.push(...new Array(s.length).fill(parseInt(i)))
    }
    return { str, indexMap }
})

const splitByIndexes = (data, indexes) => {
    const splits = []
    for (let i = 0; i < indexes.length; i++) {
        const { index, page } = indexes[i]
        // If at end of array next will be undefined which includes the rest
        let { index: nextIndex, page: nextPage } = indexes[i + 1] ?? {}

        // If next is on next page, set next to undefined which includes the rest
        if (nextPage > page) nextIndex = undefined

        // Slice based on index and nest and append
        splits.push(data[page].slice(index, nextIndex))
    }
    return splits
}

const findStarts = (combined, count, base, startRegex, exceptionList, name, pages) => {
    // Find where all the questions start
    let indexes = [];
    let currPage = 0;
    const maxPage = pages.length - 1;
    const exceptions = Object.keys(exceptionList).filter(key => key.startsWith(name))

    const hasException = exceptions.length > 0;
    const exceptionNums = exceptions.map(exception => parseInt(exception.split(" ").slice(-1)[0]));

    for (let i = 1; i <= count; i++) {
        const str = combined[currPage].str;
        const search = base.replace("{i}", i);

        // Handle tests with messed up formatting
        if (hasException && exceptionNums.includes(i)) {
            switch (exceptionList[`${name}, ${i}`][0]) {
                case "startParenth":
                    const index = str.indexOf(i + ")");
                    indexes.push({ page: currPage, index: combined[currPage].indexMap[index] });
                    break;
                default:
                    return console.error("Invalid exception type for " + name + " " + i);
            }
            continue;
        }

        // If first question, ignore stuff before
        const r = (i === 1 ? "" : startRegex) + search
        let index = str.search(new RegExp(r))

        // Account for all the stuff detected at start
        index += str.slice(index).indexOf("(");

        // If cant find probably on next page
        if (index < 0) {
            currPage++;
            // If would put on invalid page something is wrong
            if (currPage > maxPage) return console.error("Could not find " + i + " for " + name);

            // Find on next page using base
            index = combined[currPage].str.search(new RegExp(search));

            // If still cant find something went wrong
            if (index < 0) return console.error("Could not find " + i + " for " + name);
        }
        // Get index of the text object that corresponds with that part of the combined string
        indexes.push({ page: currPage, index: combined[currPage].indexMap[index] });
    }
    return indexes
}

module.exports = { save, loadPdf, getTexts, buildString, splitByIndexes, findStarts }