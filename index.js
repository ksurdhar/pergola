"use strict"
const fs = require('fs')

const CLASS_REGEX = /class\s(\S+).+{/                            // MATCHES class TestClass {
const FILE_REGEX = /\/(\w+).es6/                                 // MATCHES ./somePath/components/someFile.es6
const ES6_FUNC_REGEX = /\s+(?!function)(\S+)\(.*\)\s{/           // MATCHES sampleFunction() {
const SCOPE_FUNC_REGEX = /\S+\.(\w+)\s?=\s?function\(.*\)\s?{/   // MATCHES $scope.sampleFunction = function() {
const ARROW_FUNC_REGEX = /\S+\.(\w+)\s?=\s?\(.*\)\s?=>\s?{/      // MATCHES this._sampleFunction = () => {
const OBJ_FUNC_REGEX = /(\S+):\s?function\(.*\)\s?{/             // MATCHES sampleFunction: function(some, args) {

function notBlacklisted(lineData) {
  return !lineData.match(/if|then|angular.module|\$on|\$eval|\$apply|\[\]|subscribe/)
}

function parseClass(data, filePath) {
  const result = {
    className: null,
    functionChunks: []
  }

  const fileLines = data.split('\n')

  fileLines.forEach((line) => {
    if (line.match(CLASS_REGEX) && !result.className) {
      result.className = line.match(CLASS_REGEX)[1]
    }
    else if (line.match(/import angular/) && !result.className) {
      result.className = filePath.match(FILE_REGEX)[1]
    }
    else if (line.match(ES6_FUNC_REGEX) && notBlacklisted(line)) {
      result.functionChunks.push({ name: line.match(ES6_FUNC_REGEX)[1] })
    }
    else if (line.match(SCOPE_FUNC_REGEX)) {
      result.functionChunks.push({ name: line.match(SCOPE_FUNC_REGEX)[1] })
    }
    else if (line.match(ARROW_FUNC_REGEX)) {
      result.functionChunks.push({ name: line.match(ARROW_FUNC_REGEX)[1] })
    }
    else if (line.match(OBJ_FUNC_REGEX) && !line.match(/controller|link/)) {
      result.functionChunks.push({ name: line.match(OBJ_FUNC_REGEX)[1] })
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

function addImportStatement(className, filePath) {
  return `import ${className} from '${filePath}' \n`
}

function saveFile(data, path) {
  const fileName = path.match(FILE_REGEX)[1]
  fileName = fileName.slice(0, -4)

  fs.writeFile(`${fileName}.test.es6`, data, (err) => {
    if (err) throw err;
    console.log('It\'s saved!');
  });
}

function generateTestFile(path) {
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) throw err;
    const parsedClass = parseClass(data, path)
    const testBlocks = buildTestBlocks(parsedClass)
    testBlocks.unshift(addImportStatement(parsedClass.className, path))
    saveFile(testBlocks.join(''), path)
  });
}

function findExistingFunctions(data) {
  const functions = []
  const DESCRIBE_FUNCTION = /['\s](\S+)\(\)/ // MATCHES sampleFunction()

  const fileLines = data.split('\n')

  fileLines.forEach((line) => {
    // remove the indentation whitespace
    line = line.split(',')[0]
    line = line.replace(/ /g, "")

    if (line.match(/describe/) && line.match(DESCRIBE_FUNCTION)) {
      functions.push(line.match(DESCRIBE_FUNCTION)[1])
    }
  })
  return functions
}

function findParentFilePath(data, testFilePath) {
  const rootFileName = testFilePath.match(/(\w+).test/)[1] // MATCHES common/sampleFile.test.es6 --> sampleFile
  let importStatement = null

  const fileLines = data.split('\n')

  fileLines.forEach((line) => {
    if (line.match(rootFileName) && !importStatement) {
      importStatement = line
    }
  })

  let parentFilePath = importStatement.match(/\'(\S*)\'/)[0].slice(1,-1) // regex was catching quotations
  parentFilePath = `src/${parentFilePath}.es6`

  return parentFilePath
}

function readTestFile(path) {
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) throw err;
    const existingFunctions = findExistingFunctions(data)
    const parentFilePath = findParentFilePath(data, path)

    fs.readFile(parentFilePath, 'utf8', (err, parentData) => {
      if (err) throw err;
      console.log('we found the class!')
      // const parsedClass = parseClass(parentData, parentFilePath)
      // compare parsedClass.functionChunks with existingFunctions
      // for each of the remaining functions, call buildTestBlocks, but only for functions
      // append at the bottom of the OG test data, save the file
    });
  });
}

// generateTestFile(process.argv[2])
readTestFile(process.argv[2])






















//
