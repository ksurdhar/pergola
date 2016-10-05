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

function parseClass(data, filePath) {
  const result = {
    className: null,
    functionChunks: []
  }

  const split = data.split('\n')

  split.forEach((line) => {
    if (line.match(/class\s(\S+).+{/) && !result.className) {                 // MATCHES class TestClass {
      result.className = line.match(/class\s(\S+).+{/)[1]
    }
    else if (line.match(/import angular/) && !result.className) {
      result.className = filePath.match(/\/(\w+).es6/)[1]                     // MATCHES ./somePath/components/someFile.es6
    }
    else if (line.match(/\s+(\S+)\(.*\)\s{/)) {                               // MATCHES sampleFunction() {
      const regMatch = line.match(/\s+(\S+)\(.*\)\s{/)[1]
      result.functionChunks.push({ name: regMatch })
    }
    else if (line.match(/\S+\.(\w+)\s?=\s?\(.*\)\s?=>\s?{/)) {                // MATCHES this._sampleFunction = (argument) => {
      const regMatch = line.match(/\S+\.(\w+)\s?=\s?\(.*\)\s?=>\s?{/)[1]
      result.functionChunks.push({ name: regMatch })
    }
    else if (line.match(/\S+\.(\w+)\s?=\s?function\(.*\)\s?{/)) {             // MATCHES $scope.sampleFunction = function(args, other) {
      const regMatch = line.match(/\S+\.(\w+)\s?=\s?function\(.*\)\s?{/)[1]
      result.functionChunks.push({ name: regMatch })
    }
    else if (line.match(/(\S+):\s?function\(.*\)\s?{/)) {                     // MATCHES sampleFunction: function(some, args) {
      const regMatch = line.match(/(\S+):\s?function\(.*\)\s?{/)[1]
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
    const parsedClass = parseClass(data, path)
    const testBlocks = buildTestBlocks(parsedClass)
    testBlocks.unshift(addImportStatement(parsedClass.className, path))
    saveFile(testBlocks.join(''))
  });
}

generateTestFile(process.argv[2])
