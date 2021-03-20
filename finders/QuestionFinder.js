const qs = require("querystring");

module.exports = class QuestionFinder {

    constructor(data, test) {
        this.data = data;
        this.test = test
        this.PAGES = test.info.pages.test;

        this.height = data.formImage.Pages[0].Height;
        this.width = data.formImage.Width;

        this.combined = this.buildString(data, ...this.PAGES);
    }

    getTexts(data, start, end) {
        return data.formImage.Pages.slice(start, end + 1).map(page => page.Texts)
    }

    buildString(data, start, end) {
        const pages = this.getTexts(data, start, end)

        let output = []
        for (const page of pages) {
            let str = "";
            let indexMap = []
            for (const i in page) {
                const s = qs.unescape(page[i].R[0].T);
                // Add text to string
                str += s
                // The next s.length entires in the index array are the current index
                indexMap.push(...new Array(s.length).fill(parseInt(i)))
            }
            output.push({ str, indexMap })
        }
        return output
    }

    splitByIndexes(data, indexes) {
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

    formatCoordinates(top, left, right, bottom) {
        const PADDING = [1, 1, 1, 1]

        // Convert to percentages
        const hscale = this.width / 100
        const vscale = this.height / 100
        top /= vscale; bottom /= vscale
        left /= hscale; right /= hscale

        // Move orgin to bottom
        top = 100 - top;
        bottom = 100 - bottom;

        // Apply padding
        top += PADDING[0];
        left -= PADDING[1];
        bottom += PADDING[2];
        right -= PADDING[3];


        return [
            { x: left, y: top },
            { x: right, y: bottom }
        ]
    }

    run() { }
}