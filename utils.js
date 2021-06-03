const fs = require('fs')
const PDFParser = require("pdf2json");
const qs = require("querystring");
const PDFJS = require("pdfjs-dist/es5/build/pdf");

const save = async (name, data) => fs.writeFileSync(`./json/${name}.json`, JSON.stringify(data ?? {}, null, 4))

const loadPdf = path => new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.on("pdfParser_dataReady", async data => {
        if (TESTING) save("raw", data);
        resolve(data);
    })
    parser.loadPDF(path);
})

const fixPdf = async (path, data, fixPages) => {
    // Fix messed up texts on pages we care about
    const Pages = data.formImage.Pages;
    const pages = fixPages.map(page => (page + Pages.length) % Pages.length);
    return await Promise.all(pages.map(page => fixTexts(Pages[page].Texts, path, page + 1)));
}

const getTexts = (data, pages) => pages.map(page => data.formImage.Pages[page]?.Texts);

const opNames = {};
for (const op in PDFJS.OPS) {
    opNames[PDFJS.OPS[op]] = op;
}
const combineOpps = opps => opps.fnArray.map((op, i) => {
    return { op: opNames[op], args: opps.argsArray[i] };
});

const getOpText = (op, feild) => op.args[0].map(char => char[feild]).join("").trim();

const startPositons = {
    600: '0',
    808: '1',
    760: '2',
    172: '3',
    182: '3',
    152: '3',
    523: '4',
    522: '4',
    487: '4',
    163: '5',
    958: '6',
    1058: '7',
    1116: '7',
    887: '8',
    332: '9',
    586: 'o',
    474: 'r',
    1817: '-',
    149: '-',
    1040: '-',
    0: "-",
    311: '.',
    309: ',',
    238: '`',
    567: '',
    451: '"'
};

// Find char based on where its path starts in the font decleration (which should uniquely identify a number)
const fixChar = (objs, char, original, font) => {
    // These are added in for no reason sometimes
    if (char.charCodeAt(0) < 32) return " ";
    // If just normal char
    if (char.charCodeAt(0) < 255) return char;

    const path = objs[`${font}_path_${char}`];
    const fixed = startPositons[path?.data[3]?.args?.[0]];

    return fixed ?? original;
}

const weirdTests = [
    "HSNS6 20-21",
    "HSNS13 20-21"
];

const findOp = (opps, search, start, cancelOp) => {
    let op = opps[--start];
    while (op.op !== search) {
        if (start === 0) return null;
        if (op.op === cancelOp) return null;
        op = opps[--start];
    }
    return op;
}

const getPosition = (opps, i, isWeird) => {
    const SCALE = 16;
    const TOP = 780;
    // Find text matrix transform
    let textMatrix = findOp(opps, "setTextMatrix", i);

    // For some reason on 1 test there is a text before the first text matrix, so use moveText in that case
    let [x, y] = textMatrix
        ? textMatrix.args.slice(4)
        : textMatrix = findOp(opps, "moveText", i).args;

    // For some texts you also need to find a transform
    let transform = findOp(opps, "transform", i, "showText");
    if (transform) {
        x += transform.args[4];
        y += transform.args[5];
    }

    if (isWeird) {
        // Some texts have a moveText right before
        let moveText = findOp(opps, "setLeadingMoveText", i, "showText");
        if (moveText) {
            x += moveText.args[0] * 10;
            y += moveText.args[1] * 10;
        }

        // If on new line since last text
        if (findOp(opps, "nextLine", i, "showText")) textMatrix[5] -= 14;
    }

    // Format stuff the same as pdf2json
    x /= SCALE;
    y = (TOP - y) / SCALE;

    return { x, y };
}

const getSplits = args => {
    // Places where there is a backwards jump larger than char split
    let curText = "";
    let texts = [];
    for (let j = 0; j < args.length; j++) {
        const arg = args[j];
        if (typeof arg === "number") {
            if (arg <= -1 * args[j - 1].width) {
                texts.push(curText);
                curText = "";
            }
        }
        else {
            // Why
            if (arg.unicode.charCodeAt(0) < 32) curText += " ";
            else curText += arg.unicode;
        }
    }
    // Push last text
    texts.push(curText);

    // Filter out things that are just whitespace
    return texts.filter(text => text.trim().length);
}

function fixPage(opps, objs, isWeird) {
    const SPLITSIZE = 1;

    let fixes = [];
    let textNum = -1;
    for (let i = 0; i < opps.length; i++) {
        const op = opps[i];
        // Skip aything that isnt a showText op with actual text in it
        if (op.op !== "showText") continue;
        let text = getOpText(op, "fontChar");
        if (text.length === 0) continue

        // Texts with negative char offsets are some point are split
        const splits = getSplits(op.args[0]);
        textNum += splits.length || 1;

        // Skip anything thats already right
        let original = getOpText(op, "unicode");
        let spacing = findOp(opps, "setCharSpacing", i, "showText");
        if (text === original && (!spacing || (spacing.args[0] < SPLITSIZE))) continue;

        // Covert weird fontChars to correct nums
        const font = findOp(opps, "setFont", i).args[0];

        // Trim invalid chars
        text = text.replace(/^[\u0000-\u001F]+|[\u0000-\u001F]+$/g, "")
        text = text
            .split("")
            .map((char, i) => fixChar(objs, char, original[i], font) ?? "") // Fix characters
            .join("");

        // If was actually all spaces
        if (!text.trim()) { textNum--; continue; }
        // If was already correct
        if (text === original && (!spacing || (spacing.args[0] < SPLITSIZE))) continue;

        // If large char spacing split into seperate texts
        const { x, y } = getPosition(opps, i, isWeird);
        let deleteCount = 0;
        if (spacing && (spacing.args[0] > SPLITSIZE)) {
            const chars = text.split("");
            for (let j = 0; j < chars.length; j++) {
                fixes.push({
                    textNum,
                    deleteCount: j == 0 ? 1 : 0,
                    text: {
                        x: x + (j * spacing.args[0]) / 16, y,
                        R: [{ T: text[j] }]
                    },
                    // Debugging info
                    type: "splitSpacing",
                    original
                });
                textNum++;
            }
            textNum--;
        }
        // Else just add
        else {
            // If already was text there replace instead of adding
            deleteCount = original.length ? 1 : 0;
            fixes.push({
                textNum,
                deleteCount,
                text: {
                    x, y,
                    R: [{ T: text }]
                },
                // Debugging info
                type: "replace",
                original
            });
        }
    }

    return fixes;
}

async function loadPage(path, pageNum) {
    const pdf = await PDFJS.getDocument(path).promise;
    const page = await pdf.getPage(pageNum);
    const opps = combineOpps(await page.getOperatorList());
    const objs = page.commonObjs._objs;
    return { opps, objs };
}

const fixTexts = async (data, path, pageNum) => {
    const isWeird = weirdTests.find(test => path.includes(test));

    // if (TESTING && pageNum !== 5) return data
    const { opps, objs } = await loadPage(path, pageNum);

    if (TESTING) save(pageNum + "/texts", data.map(text => qs.unescape(text.R[0].T)));

    const fixes = fixPage(opps, objs, isWeird);
    for (const fix of fixes) data.splice(fix.textNum, fix.deleteCount, fix.text);

    if (TESTING) {
        save(pageNum + "/opps", opps);
        save(pageNum + "/obbjs", objs);
        save(pageNum + "/fixes", fixes)
        save(pageNum + "/fixed", data);
        save(pageNum + "/fixedTexts", data.map(text => qs.unescape(text.R[0].T)));
    }

    return data;
}

const buildString = texts => texts.map(page => {
    let str = "";
    let indexMap = [];
    for (const i in page) {
        const s = qs.unescape(page[i].R[0].T);
        // Add text to string
        str += s;
        // The next s.length entires in the index array are the current index
        indexMap.push(...new Array(s.length).fill(parseInt(i)));
    }
    return { str, indexMap };
})


const gcd = (a, b) => b ? gcd(b, a % b) : a;

const fracToDecimal = (frac) => {
    const [numerator, denominator] = frac.split("/");
    return (numerator / denominator).toString();
}

const decimalToFrac = num => {
    const decimal = num.toString().split(".")[1];
    if (!decimal) return console.error("Invalid decimal " + num);

    const tens = Math.pow(10, decimal.length);
    let denominator = tens;
    let numerator = tens * parseFloat(num);

    const divisor = gcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
    return numerator + "/" + denominator;
}

const improperToMixed = frac => {
    const [numerator, denominator] = frac.split("/");
    if (!denominator) return console.error("Invalid fraction " + frac);

    const whole = Math.floor(numerator / denominator);
    return `${whole} ${numerator % denominator}/${denominator}`;
}

const range = (start, end) => {
    const arr = [];
    for (let i = start; i <= end; i++) { arr.push(i) }
    return arr;
}

module.exports = { save, weirdTests, loadPdf, fixPdf, getTexts, buildString, decimalToFrac, fracToDecimal, improperToMixed, range }