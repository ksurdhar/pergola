var fs = require('fs')

function saveFile(data) {
  fs.writeFile('message.test.es6', data, (err) => {
    if (err) throw err;
    console.log('It\'s saved!');
  });
}

function addImportStatement(className, filePath) {
  return `import ${className} from '${filePath}' \n`
}

function parseClass(data) {
  var result = {
    className: null,
    functionChunks: []
  }

  var split = data.split('\n')

  split.forEach((line) => {
    if (line.match(/class\s(.+)\s{/) && !result.className) {  // MATCHES CLASS DECLARATIONS -- "class TestClass {", returns "TestClass"
      result.className = line.match(/class\s(.+)\s{/)[1]
    }
    else if (line.match(/(.+\(\))\s{/)) { // MATCHES FUCTION DECLARATIONS -- " blah() {"
      var regMatch = line.match(/(.+\(\))\s{/)[1]


      result.functionChunks.push({ name: regMatch })
    }
  })

  return result
}

function buildBlocks(parsedClass) {
  var chunkStrings = []

  chunkStrings.push(`
describe('${parsedClass.className}', () => {
  beforeEach(() => {
    // prep here
  })
`)

  parsedClass.functionChunks.forEach((chunk) => {
    chunkStrings.push(`
  describe('${chunk.name}', () => {
    beforeEach(() => {
      // prep here
    })

    it('does something', () => {
      expect()
    })
  })
`)
  })

  chunkStrings.push('})')

  return chunkStrings
}

fs.readFile('./test.es6', 'utf8', (err, data) => {
  if (err) throw err;
  var parsedClass = parseClass(data)
  var blocks = buildBlocks(parsedClass)
  blocks.unshift(addImportStatement(parsedClass.className, './test.es6'))
  saveFile(blocks.join(''))
});


// take a file
// read each line
// parse for class, then search for function declarations
// create a new file.test.es6
