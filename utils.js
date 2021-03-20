const fs = require('fs')

const save = (name, data) => fs.writeFileSync(`./json/${name}.json`, JSON.stringify(data ?? {}, null, 4))

module.exports = { save }