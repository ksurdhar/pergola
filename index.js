const fs = require('fs')

function saveFile(data, path) {
  fs.writeFile('folder.test.es6', data, (err) => {
    if (err) throw err;
    console.log('It\'s saved!');
  });
}

function addImportStatement(className, filePath) {
  return `import ${className} from '${filePath}' \n`
}

function parseClass(data) {
  const result = {
    className: null,
    functionChunks: []
  }

  const split = data.split('\n')

  split.forEach((line) => {
    if (line.match(/class\s(\S+).+{/) && !result.className) {  // MATCHES CLASS DECLARATIONS -- "class TestClass {", captures "TestClass"
      result.className = line.match(/class\s(\S+).+{/)[1]
    }
    else if (line.match(/\s+(\S+)\(.*\)\s{/)) { // MATCHES FUCTION DECLARATIONS -- " blah() {", captures "blah"
      const regMatch = line.match(/\s+(\S+)\(.*\)\s{/)[1]
      result.functionChunks.push({ name: regMatch })
    }
  })

  return result
}

function buildTestBlocks(parsedClass) {
  const chunkStrings = []

  chunkStrings.push(`
describe('${parsedClass.className}', () => {
  beforeEach(() => {
    // prep here
  })
`)

  parsedClass.functionChunks.forEach((chunk) => {
    chunkStrings.push(`
  describe('${chunk.name}()', () => {
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

function generateTestFile(path) {
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) throw err;
    const parsedClass = parseClass(data)
    const testBlocks = buildTestBlocks(parsedClass)
    testBlocks.unshift(addImportStatement(parsedClass.className, path))
    saveFile(testBlocks.join(''))
  });
}

generateTestFile(process.argv[2])
