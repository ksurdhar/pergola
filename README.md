# Pergola - The Jasmine Boilerplate Generator

### Usage

Pergola has two modes: it can either generate a brand new test file, or it can incrementally add test boilerplate to an existing file. To create a new test file at the root of your directory, pass pergola the path of the file you want tested:

```
pergola sampleFile.es6
```

To incrementally add tests to the bottom of your existing test file, pass pergola the path of the test file:

```
pergola testFile.test.es6
```


### Assumptions

#### Function Patterns

Pergola uses a series of regexes to infer what functions need tests. If your function doesn't match one of these patterns, it won't generate boilerplate.

```
 sampleFunction() {
 $scope.sampleFunction = function() {
 this._sampleFunction = () => {
 sampleFunction: function(some, args) {
```

#### 
#### File Path Inference

### About
