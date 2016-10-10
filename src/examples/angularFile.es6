import ClipboardHTMLBuilder from 'common/utils/clipboard/clipboardHTMLBuilder'
import ColorPicker from 'common/directives/colorPicker/colorPicker'
import permissions from 'common/services/permissions'

import './formatBar.less'

var autoSum, colorService, encoding, formatRecords, ClipboardContext, ClipboardUtils, DataFormat, Range, Region, Sheet, SheetClip, StreamSubscriptions, angular, copyPasteModal, events, generateUUID, globalEventStream, md5, ngDeps, sheetMediator, singletons

angular = require('@workday/angularjs')

events = require('@workday/events')

Range = require('common/factories/range')

DataFormat = require('common/resources/dataFormat')

Region = require('common/resources/region')

Sheet = require('common/resources/sheet')

autoSum = require('common/services/autoSum')

colorService = require('common/services/colorService')

encoding = require('@workday/base26-encoding')

formatRecords = require('common/services/formatting')

globalEventStream = require('common/services/globalEventStream')

sheetMediator = require('common/services/sheetMediator')

singletons = require('common/services/singletons')

StreamSubscriptions = require('common/services/streamSubscriptions')

md5 = require('md5')

ClipboardContext = require('common/utils/clipboard/clipboardContext')

ClipboardUtils = require('common/utils/clipboard/clipboardUtils')

generateUUID = require('common/utils/generateUUID')

SheetClip = require('common/utils/sheetclip')

copyPasteModal = require('components/copyPasteModal')

ngDeps = [ require('common/directives/dropdownToggle').name, require('common/directives/fileDragDrop').name, require('./fontSelect').name, require('./fontSizeSelect').name, require('common/directives/focus').name, require('components/modal').name, require('components/shareModal').name, require('components/toast').name ]

const DEFAULT_FONT_NAME = 'Arial'
const DEFAULT_FONT_SIZE = 10

module.exports = angular.module('directives.formatBar', ngDeps).directive('formatBar', function($rootElement) {
  return {
    restrict: 'E',
    template: require('./formatBar.tpl.jade'),
    replace: true,
    controller: function($scope, modal, $_toast, $element) {
      'ngInject'
      var _addDecimal, _adjustDecimal, _cellFormattingChangedHandler, _chooseDestinationCell, _commitChanges, _deriveFormat, _getLastCopyMetaData, _getMetaDataFromLocalStorageMatchingPasteData, _getPasteMetaData, _mergeChartCell, _removeDecimal, _shareObject, _streamSubscriptions, _updateState, backgroundColorElement, element, fontColorElement, ifs

      const theSidebarState = singletons.get('sidebarState')
      const theSocket = singletons.get('socket')

      $scope.fonts = [ 'Arial', 'Courier New', 'Georgia', 'Roboto', 'Times New Roman', 'Trebuchet MS', 'Verdana' ]
      $scope.fontSizes = (function() {
        var i, results
        results = []
        for (ifs = i = 6; i <= 36; ifs = i += 2) {
          results.push(ifs)
        }
        return results
      })()
      $scope.fontSizes.splice(3, 0, 11)
      $scope.currentFont = ''
      $scope.currentFontSize = ''
      $scope.horizontalAlignments = [
        {
          name: 'Left',
          value: 'LEFT',
        }, {
          name: 'Center',
          value: 'CENTER',
        }, {
          name: 'Right',
          value: 'RIGHT',
        },
      ]
      $scope.verticalAlignments = [
        {
          name: 'Top',
          value: 'TOP',
        }, {
          name: 'Center',
          value: 'CENTER',
        }, {
          name: 'Bottom',
          value: 'BOTTOM',
        },
      ]
      element = $element[0]
      $scope.pasteBuffer = window.localStorage.lastCopyNonce
      _streamSubscriptions = new StreamSubscriptions()
      $scope.populateDataFormats = function() {
        return DataFormat.getFormats().then(function(formats) {
          return $scope.$apply(function() {
            $scope.dataFormats = formats.formats
            return $scope.dataCategories = formats.categories
          })
        })
      }
      $scope.showingSplats = true
      _shareObject = $scope.workbook || sheetMediator.getActiveSheet()
      $scope.fileShared = _shareObject.shared

      const _grantedListener = theSocket.subscribe('_type', 'Granted', function(msg) {
        $scope.$apply(function() {
          if (msg.reference.objectID === $scope.workbook.workbookID) {
            // TODO replace COMMENT permission with READ until COMMENT is supported in this app
            if (msg.reference.objectPermission === permissions.COMMENT) {
              $scope.workbook.workbookPermission = permissions.READ
            } else {
              $scope.workbook.workbookPermission = msg.reference.objectPermission
            }
            $scope.workbook.shared = true
            $scope.fileShared = true
          }
        })
      })

      $scope.$on('$destroy', function() {
        if (_grantedListener) {
          return theSocket.unsubscribe('_type', _grantedListener)
        }
      })
      $scope.$watch('fontColor', function(newColor) {
        if (!newColor) {
          return
        }
        return $scope.formatRange({
          FONT_COLOR: colorService.hexToInt(newColor),
        })
      })
      $scope.$watch('backgroundColor', function(newColor) {
        if (!newColor) {
          return
        }
        return $scope.formatRange({
          PATTERN_FILL_TYPE: 'SOLID',
          PATTERN_FILL_FOREGROUND_COLOR: colorService.hexToInt(newColor),
        })
      })
      function _formatRecordForSelection(cell) {
        var _, column, columnAddress, ref, ref1, row, rowAddress
        const selection = sheetMediator.getSelection()
        if (selection.isColumnar) {
          ref = encoding.splitAddress(sheetMediator.getActiveCell().address), columnAddress = ref[0], _ = ref[1]
          column = sheetMediator.getActiveSheet().getColumnByName(columnAddress)
          return column.formattingMap || {}
        } else if (selection.isRow) {
          ref1 = encoding.splitAddress(sheetMediator.getActiveCell().address), _ = ref1[0], rowAddress = ref1[1]
          row = sheetMediator.getActiveSheet().getRowByName(rowAddress)
          return row.formattingMap || {}
        } else {
          return formatRecords.records[cell.directFormattingID] || {}
        }
      }
      _addDecimal = function(currentFmt) {
        // see if this format already has a .0 and, if so, change it to .00
        // if the format does not have .0, then for each 0, convert to 0.0
        // if no 0 found, then we will leave it alone
        var newFmt
        newFmt = currentFmt.replace(/\./g, '.0')
        if (newFmt === currentFmt) {
          newFmt = currentFmt.replace(/0/g, '0.0')
        }
        return [ newFmt, newFmt !== currentFmt ]
      }
      _removeDecimal = function(currentFmt) {
        // see if this format already has a .00 and, if so, change it to .0
        // if the format does not have .00, then if it has .0, change to empty string
        // if no 0 found, return original format
        var newFmt
        newFmt = currentFmt.replace(/\.00/g, '.0')
        if (newFmt === currentFmt) {
          newFmt = currentFmt.replace(/\.0/g, '')
        }
        return [ newFmt, newFmt !== currentFmt ]
      }
      _adjustDecimal = function(adjuster) {
        var changed, newNumFmt, ref, ref1, ref2
        const activeCell = sheetMediator.getActiveCell()
        const formatRecord = _formatRecordForSelection(activeCell)
        changed = false
        if (formatRecord.NUMFMT_FORMAT_CODE) {
          ref = adjuster(formatRecord.NUMFMT_FORMAT_CODE), newNumFmt = ref[0], changed = ref[1]
        } else if (!isNaN(activeCell.renderingText)) {
          ref1 = _deriveFormat(activeCell.renderingText, adjuster), newNumFmt = ref1[0], changed = ref1[1]
        } else {
          ref2 = adjuster('0'), newNumFmt = ref2[0], changed = ref2[1]
        }
        if (changed) {
          return $scope.formatRange({
            NUMFMT_FORMAT_CODE: newNumFmt,
          })
        }
      }
      _commitChanges = function() {
        return sheetMediator.getActiveSheetController().stopEditingCell(true)
      }
      _deriveFormat = function(val, adjust) {
        // derive the format based on the value
        var dp, fmt
        dp = val.indexOf('.')
        fmt = '0'
        if (dp > -1) {
          fmt += '.' + Array(val.length - dp).join('0')
        }
        return adjust(fmt)
      }
      _mergeChartCell = function(destinationCell) {
        return _commitChanges().then(function() {
          return globalEventStream.publish('chartPlaced', destinationCell)
        })
      }
      _chooseDestinationCell = function(entityTypeName) {
        // FIXME: Range vs. selection
        var _finally, currentSelection, currentSheet, sourceRange, toastInstance
        currentSheet = sheetMediator.getActiveSheet()
        currentSelection = sheetMediator.getSelection().toString()
        sourceRange = function(destSheetID) {
          if (destSheetID === currentSheet.id) {
            return currentSelection
          } else {
            return "'" + currentSheet.escapedName + "'!" + currentSelection
          }
        }
        if ($scope.pickingCell === true) {
          return
        }
        toastInstance = $_toast.open({
          scope: $scope,
          toastClass: 'gc-chart-destination-toast',
          template: `<div>Select a destination cell for the ${entityTypeName}.<a class='close' ng-click='cancel()'>Dismiss</a></div>`,
          controller: function($scope, toastInstance) {
            'ngInject'
            $scope.cancel = function() {
              return toastInstance.dismiss()
            }
            return sheetMediator.pickCell().then(function(cell) {
              return toastInstance.close({
                cell: cell,
                selection: sourceRange(cell.sheetID),
              })
            })
          },
        })
        toastInstance.opened.then(function() {
          $scope.pickingCell = true
          return $scope.sheetInputHandler.disable()
        })
        _finally = function() {
          var ref
          $scope.pickingCell = false
          $scope.sheetInputHandler.enable()
          // TODO: Fix DOM access...
          return (ref = element.querySelector('button.chart')) != null ? ref.removeAttribute('disabled') : void 0
          // enable chart button
        }
        toastInstance.result.then(_finally, _finally)
        return toastInstance.result
      }

      _updateState = function(cell = null, range = null) {
        if (!cell) {
          cell = sheetMediator.getActiveCell()
        }

        if (!range) {
          range = sheetMediator.getActiveRange()
        }

        const format = formatRecords.records[cell.directFormattingID] || {}
        const sheetFormat = formatRecords.records[sheetMediator.getActiveSheet().formattingMapKey] || {}
        $scope.isWholeRowOrColumn = false

        if (!(range && range.start && range.end)) {
          $scope.bold = !!(format.FONT_BOLD || sheetFormat.FONT_BOLD)
          $scope.italic = !!(format.FONT_ITALIC || sheetFormat.FONT_ITALIC)
          $scope.underline = !!(format.FONT_UNDERLINE || sheetFormat.FONT_UNDERLINE)
          $scope.wrap = !!(format.ALIGNMENT_WRAP_TEXT || sheetFormat.ALIGNMENT_WRAP_TEXT)
          $scope.color = colorService.intToCSSRGB(format.FONT_COLOR)
          $scope.bgColor = colorService.intToCSSRGB(format.PATTERN_FILL_FOREGROUND_COLOR)
        } else {
          $scope.bold = false
          $scope.italic = false
          $scope.underline = false
          $scope.wrap = false

          const [ topCol, topRow ] = encoding.getIndex(range.start)
          const [ botCol, botRow ] = encoding.getIndex(range.end)
          if (-1 === topCol || -1 === topRow || -1 === botCol || -1 === botRow) {
            $scope.isWholeRowOrColumn = true
          }
        }
        // TODO: Move Arial and 10 into configuration
        $scope.currentFont = format.FONT_NAME || sheetFormat.FONT_NAME || DEFAULT_FONT_NAME
        $scope.currentFontSize = format.FONT_SIZE || sheetFormat.FONT_SIZE || DEFAULT_FONT_SIZE
      }

      $scope.autoSum = autoSum

      $scope.clearRange = function(clearWormhole = false) {
        const isSingleCellWhichIsChart = sheetMediator.getSelection().degenerate() && sheetMediator.getActiveCell().isChart()
        const clearMerges = isSingleCellWhichIsChart

        Sheet.clear(sheetMediator.getActiveSheet().id, sheetMediator.getSelection().toExpandedString(), clearWormhole, clearMerges)
          .then(() => {
            globalEventStream.publish('rangeCleared')
          })
      }

      $scope.clearFormatting = function() {
        return Sheet.clearFormatting(sheetMediator.getActiveSheet().id, sheetMediator.getSelection().toExpandedString())
      }
      $scope.clearFormulas = function() {
        return Sheet.clearFormulas(sheetMediator.getActiveSheet().id, sheetMediator.getSelection().toExpandedString())
      }

      function _getDataMatrixFromRange(rangeToCopy) {
        function getFiniteRangeToCopy() {
          if (rangeToCopy.isInfinite) {
            const activeSheet = sheetMediator.getActiveSheet()
            const maxCol = encoding.getColumnName(activeSheet.sheetMaxColumn)
            const maxRow = encoding.getRowName(activeSheet.sheetMaxRow)
            if (rangeToCopy.isWholeSheet()) {
              return new Range('A1', `${ maxCol }${ maxRow }`)
            } else if (rangeToCopy.isColumnar) {
              return new Range(`${ rangeToCopy.topLeft }1`, `${ rangeToCopy.bottomRight }${ maxRow }`)
            } else {
              return new Range(`A${ rangeToCopy.topLeft }`, `${ maxCol }${ rangeToCopy.bottomRight }`)
            }
          } else {
            return rangeToCopy
          }
        }

        var addr, botRightAddr, brIn, cell, data, i, ic, ir, j, ref, ref1, ref2, row, tlIn, topLeftAddr

        const range = getFiniteRangeToCopy()

        ref = range.toExpandedString().split(':'), topLeftAddr = ref[0], botRightAddr = ref[1]
        tlIn = encoding.getIndex(topLeftAddr)
        brIn = encoding.getIndex(botRightAddr)
        data = []
        for (ir = i = 0, ref1 = (brIn[1] - tlIn[1]) + 1; i < ref1; ir = i += 1) {
          row = []
          for (ic = j = 0, ref2 = (brIn[0] - tlIn[0]) + 1; j < ref2; ic = j += 1) {
            addr = encoding.getAddress(ic + tlIn[0], ir + tlIn[1])
            cell = sheetMediator.getActiveSheet().getCachedCell(addr)
            row.push(cell ? cell.renderingText : void 0)
          }
          data.push(row)
        }
        return data
      }

      $scope.copyAddresses = function(rangeToCopy, $event, isCut = false) {
        $scope.pasteBuffer = null
        const nonce = generateUUID()
        $scope.pasteBuffer = nonce
        globalEventStream.publish('rangeCopied', rangeToCopy, isCut)
        const dataMatrix = _getDataMatrixFromRange(rangeToCopy)
        const valuesStr = SheetClip.stringify(dataMatrix)
        const clipboardMetaDataStr = JSON.stringify(ClipboardUtils.getMetaData(rangeToCopy, isCut, valuesStr))
        window.localStorage[`paste_${ nonce }`] = clipboardMetaDataStr
        window.localStorage.lastCopyNonce = nonce
        const clipboardContext = ClipboardContext.get($event)
        if (clipboardContext) {
          // FIXME: Range vs. selection
          clipboardContext.clearData()
          try {
            const htmlBuilder = new ClipboardHTMLBuilder(dataMatrix, clipboardMetaDataStr)
            clipboardContext.setData('text/html', htmlBuilder.build())
          } catch (_error) {
            // Browsers may fail here, but continue to try to set generic text below
          }
          return clipboardContext.setData('Text', valuesStr)
        }
      }

      $scope.copyRange = function($event, isCut) {
        if (isCut == null) {
          isCut = false
        }
        if (ClipboardUtils.isCopyOrCutEvent($event)) {
          return $scope.copyAddresses(sheetMediator.getSelection(), $event, isCut)
        } else {
          // Don't attempt mouse events on non-clipboard events since the browser model may not allow it.
          // Instead, inform the user about key commands.
          // Note that the input handler is not disabled while this modal is up, so the user can theoretically
          // use the key commands while the info is visible.
          return copyPasteModal(modal)
        }
      }
      $scope.cutRange = function($event) {
        return $scope.copyRange($event, true)
      }
      $scope.decreaseDecimals = function() {
        // if the cell is already formatted, try to remove a decimal place from it
        // otherwise, we leave this alone
        return _commitChanges().then(function() {
          return _adjustDecimal(_removeDecimal)
        })
      }

      $scope.formatComma = function() {
        const cell = sheetMediator.getActiveCell()
        const formatRecord = _formatRecordForSelection(cell)
        const formatCode = formatRecord.NUMFMT_FORMAT_CODE === '#,##0.00' ? 'General' : '#,##0.00'
        return $scope.formatRange({
          NUMFMT_FORMAT_CODE: formatCode,
        })
      }

      $scope.formatCurrency = function() {
        const cell = sheetMediator.getActiveCell()
        const formatRecord = _formatRecordForSelection(cell)
        const formatCode = formatRecord.NUMFMT_FORMAT_CODE === '$#,##0.00;$-#,##0.00' ? 'General' : '$#,##0.00;$-#,##0.00'
        return $scope.formatRange({
          NUMFMT_FORMAT_CODE: formatCode,
        })
      }

      $scope.formatPercent = function() {
        const cell = sheetMediator.getActiveCell()
        const formatRecord = _formatRecordForSelection(cell)
        const formatCode = formatRecord.NUMFMT_FORMAT_CODE === '0.00%' ? 'General' : '0.00%'
        return $scope.formatRange({
          NUMFMT_FORMAT_CODE: formatCode,
        })
      }

      // FIXME: Range vs. selection
      $scope.formatRange = function(format) {
        if (!format) {
          return
        }
        return _commitChanges().then(function() {
          return Sheet.updateFormat(sheetMediator.getActiveSheet().id, sheetMediator.getSelection(), format)
        })
      }
      $scope.increaseDecimals = function() {
        // if the cell is already formatted, try to add a decimal place to it
        // otherwise, we turn this into a new format 0.0
        return _commitChanges().then(function() {
          return _adjustDecimal(_addDecimal)
        })
      }
      $scope.insertContent = function() {
        var input
        if (input = element.querySelector('.contentUpload input')) {
          input.value = null
          return input.click()
        }
      }
      $scope.onContentFileSelect = function(files) {
        if (files.length === 0) {
          return
        }
        return sheetMediator.getActiveCell().uploadContent(files[0])
      }

      $scope.unmergeCell = function() {
        globalEventStream.publish('cellUnmerged')
        const cell = sheetMediator.getActiveCell()
        const sheet = sheetMediator.getActiveSheet()
        if (sheet.cellIsMerged(cell)) {
          sheet.unmergeCell(cell)
        }
      }

      $scope.deleteChart = function() {
        if (sheetMediator.getActiveCell().isChart()) {
          Sheet.clear(sheetMediator.getActiveSheet().id, sheetMediator.getSelection().toExpandedString(), false, true).then(() => {
            globalEventStream.publish('cellUnmerged')
          })
        }
      }

      $scope.insertChart = function() {
        var chartButton, ref
        if (sheetMediator.getActiveCell().isChart()) {
          return
        }
        if ((ref = _chooseDestinationCell('chart')) != null) {
          ref.then(function(result) {
            var cell, cellRange, currentSelection, selectionRange
            cell = result.cell
            currentSelection = result.selection
            selectionRange = new Range(result.selection)
            cellRange = new Range(result.cell.address + ':' + result.cell.address)
            if (selectionRange.contains(cellRange) && !currentSelection.match('!')) {
              return
            }
            return sheetMediator.getActiveSheet().updateValue(cell.address, '=chart("line", ' + currentSelection + ', {"grid-lines", "major-y"})').then(function() {
              _mergeChartCell(cell)
              return window.setTimeout(function() {
                sheetMediator.setActiveCell(cell)
                return globalEventStream.publish('insertChart')
              }, 0)
            })
          })
        }
        // TODO: Fix DOM call
        if (chartButton = element.querySelector('button.chart')) {
          chartButton.setAttribute('disabled', true)
        }
        window.setTimeout(function() {
          var ref1
          return (ref1 = element.querySelector('.tooltip')) != null ? ref1.style.display = 'none' : void 0
        }, 300)
        return true
      }

      function _pasteFromMetaData(metaData, opts) {
        const activeSheet = sheetMediator.getActiveSheet()
        activeSheet.pasteRange(sheetMediator.getSelection().toString(), metaData.copyRange, opts, activeSheet.id, metaData.sheetID, metaData.isCut)
          .then(function(msg) {
            globalEventStream.publish('rangePasted', msg)
          })
      }

      function _pasteWithoutMetaData(valuesStr) {
        const edits = []
        const [ colIdx, rowIdx ] = encoding.getIndex(sheetMediator.getActiveCell().address)
        let numRowsToPaste    = 1
        let numColumnsToPaste = 1
        try {
          const rows = SheetClip.parse(valuesStr)
          numRowsToPaste = rows.length
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            numColumnsToPaste = Math.max(numColumnsToPaste, row.length)
            for (let j = 0; j < row.length; j++) {
              const value = row[j]
              edits.push({
                range: encoding.getAddress(colIdx + j, rowIdx + i),
                value: value.replace(/\r/g, ''),
              })
            }
          }
        } catch (_error) {
          // Ignore parse exception
          if (valuesStr) {
            edits.push({
              range: encoding.getAddress(colIdx, rowIdx),
              value: valuesStr.replace(/\r/g, ''),
            })
          }
        }
        if (edits.length > 0) {
          const sheetController     = sheetMediator.getActiveSheetController()
          const topLeftAddress      = encoding.getAddress(colIdx, rowIdx)
          const bottomRightAddress  = encoding.getAddress(colIdx + (numColumnsToPaste - 1), rowIdx + (numRowsToPaste - 1))
          const pastedRangeStr      = `${ topLeftAddress }:${ bottomRightAddress }`
          sheetController.setActiveRangeAndCell(pastedRangeStr)
          sheetController.sheet.updateValues(edits)
        }
      }

      _getMetaDataFromLocalStorageMatchingPasteData = function(valuesStr) {
        var metaData, metaDataStr, nonce
        if (nonce = window.localStorage.lastCopyNonce) {
          if (metaDataStr = window.localStorage['paste_' + nonce]) {
            metaData = JSON.parse(metaDataStr)
            if (metaData.valuesHash === md5(valuesStr)) {
              return metaData
            }
          }
        }
      }
      _getPasteMetaData = function(clipboardData) {
        if (clipboardData.metaData) {
          // Meta data was extracted directly from the HTML, so the copy came from us
          return clipboardData.metaData
        } else {
          // Meta data could not be retrieved from clipboard HTML, so see if the pasted data matches
          // the fingerprint hash in localStorage's most recent clipboard meta data, which contains the
          // type of operation (cut vs copy)
          // This strategy is needed when copying from our app, but when the browser doesn't support text/html clipboards
          return _getMetaDataFromLocalStorageMatchingPasteData(clipboardData.valuesStr)
        }
      }
      _getLastCopyMetaData = function() {
        var metaDataStr, nonce
        if (nonce = window.localStorage.lastCopyNonce) {
          if (metaDataStr = window.localStorage['paste_' + nonce]) {
            return JSON.parse(metaDataStr)
          }
        }
      }

      $scope.pasteRange = function(evt = null, opts = {}) {
        if (evt) {
          const clipboardContext = ClipboardContext.get(evt)
          if (clipboardContext) {
            const clipboardData = clipboardContext.getData()
            if (clipboardData) {
              const metaData = _getPasteMetaData(clipboardData)
              if (metaData) {
                _pasteFromMetaData(metaData, opts)
              } else {
                _pasteWithoutMetaData(clipboardData.valuesStr)
              }
            }
          } else {
            copyPasteModal(modal)
          }
        } else {
          const metaData = _getLastCopyMetaData()
          if (metaData) {
            _pasteFromMetaData(metaData, opts)
          }
        }
      }

      $scope.pasteRangeFormatting = function() {
        $scope.pasteRange(null, {
          pasteFormulas: false,
          pasteValues: false,
        })
      }

      $scope.pasteRangeFormulas = function() {
        $scope.pasteRange(null, {
          pasteFormatting: false,
          pasteValues: false,
        })
      }

      $scope.pasteRangeLinks = function() {
        $scope.pasteRange(null, {
          pasteFormatting: false,
          pasteFormulas: false,
          pasteLinks: true,
        })
      }

      $scope.pasteRangeValues = function() {
        $scope.pasteRange(null, {
          pasteFormatting: false,
          pasteFormulas: false,
        })
      }

      $scope.redo = function() {
        return sheetMediator.getActiveSheet().redo()
      }
      $scope.shareWorkbook = function() {
        return modal.open({
          template: require('components/shareModal/shareModal.tpl.jade')(),
          windowClass: 'share-object-modal-window',
          controller: 'shareModalCtrl',
          resolve: {
            shareObject: function() {
              return _shareObject
            },
            shareSubjects: function() {
              return _shareObject.shareSubjects()
            },
          },
        })
      }
      $scope.undo = function() {
        return sheetMediator.getActiveSheet().undo()
      }
      $scope.updateBorders = function(where, color) {
        var currentSelection
        if (color == null) {
          color = '000000'
        }
        currentSelection = sheetMediator.getSelection().toExpandedString()
        return _commitChanges().then(function() {
          return sheetMediator.getActiveSheet().updateBorders(currentSelection, where, color)
        })
      }

      $scope.toggleBold = function() {
        const cell = sheetMediator.getActiveCell()
        const selection = sheetMediator.getSelection()
        const formatRecord = _formatRecordForSelection(cell)
        const isBold = !formatRecord.FONT_BOLD
        return _commitChanges().then(function() {
          return Sheet.updateFormat(cell.sheetID, selection, {
            FONT_BOLD: isBold,
          })
        })
      }

      $scope.toggleItalic = function() {
        const cell = sheetMediator.getActiveCell()
        const selection = sheetMediator.getSelection()
        const formatRecord = _formatRecordForSelection(cell)
        const isItalic = !formatRecord.FONT_ITALIC
        return _commitChanges().then(function() {
          return Sheet.updateFormat(cell.sheetID, selection, {
            FONT_ITALIC: isItalic,
          })
        })
      }

      $scope.toggleUnderline = function() {
        const cell = sheetMediator.getActiveCell()
        const selection = sheetMediator.getSelection()
        const formatRecord = _formatRecordForSelection(cell)
        const isUnderlined = formatRecord.FONT_UNDERLINE === 'SINGLE' ? null : 'SINGLE'
        return _commitChanges().then(function() {
          return Sheet.updateFormat(cell.sheetID, selection, {
            FONT_UNDERLINE: isUnderlined,
          })
        })
      }

      $scope.toggleWordWrap = function() {
        const cell = sheetMediator.getActiveCell()
        const selection = sheetMediator.getSelection()
        return _commitChanges().then(function() {
          globalEventStream.publish('cellsWrapped', selection, cell)
        })
      }

      $scope.toggleSidebar = function(whichDrawer) {
        // called by "All Changes Saved Automatically"
        theSidebarState.toggleSidebar(whichDrawer)
      }

      $scope.onFontColor = function(color) {
        return $scope.formatRange(color === null ? {
          FONT_COLOR: null,
        } : {
          FONT_COLOR: colorService.rgbToInt(color),
        })
      }
      $scope.onBackgroundColor = function(color) {
        return $scope.formatRange(color === null ? {
          PATTERN_FILL_TYPE: 'NONE',
          PATTERN_FILL_FOREGROUND_COLOR: null,
        } : {
          PATTERN_FILL_TYPE: 'SOLID',
          PATTERN_FILL_FOREGROUND_COLOR: colorService.rgbToInt(color),
        })
      }
      fontColorElement = $rootElement[0].querySelector('.font-color color-picker')
      $scope.fontColorPicker = new ColorPicker(fontColorElement)
      $scope.fontColorPicker.subscribe($scope.onFontColor)
      backgroundColorElement = $rootElement[0].querySelector('.background-color color-picker')
      $scope.backgroundColorPicker = new ColorPicker(backgroundColorElement)
      $scope.backgroundColorPicker.subscribe($scope.onBackgroundColor)
      //
      // Sheet state changes
      //
      _cellFormattingChangedHandler = function(cell) {
        if (sheetMediator.getActiveCell().address === cell.address) {
          return $scope.safeApply(function() {
            return _updateState(cell)
          })
        }
      }
      function _activeCellHandler(cell)  {
        $scope.safeApply(function() {
          _updateState(cell)
        })
      }
      function _activeRangeHandler(range) {
        $scope.safeApply(function() {
          _updateState(sheetMediator.getActiveCell(), range)
        })
      }

      _streamSubscriptions.add(
        globalEventStream.subscribe('cellFormattingChanged', _cellFormattingChangedHandler),
        globalEventStream.subscribe('activeCell', _activeCellHandler),
        globalEventStream.subscribe('activeRange', _activeRangeHandler)
      )

      return $scope.$on('$destroy', function() {
        return _streamSubscriptions.dispose()
      })
    },
    link: function(scope, jqlEl) {
      var _attachHandlers, _dataFormatsClick, _horizontalAlignmentClick, _removeHandlers, _toggleHandlers, _verticalAlignmentClick, element
      element = jqlEl[0]
      // Font name
      scope.onFontChange = function(font) {
        return scope.formatRange({
          FONT_NAME: font,
        })
      }
      // Font size
      scope.onFontSizeChange = function(size) {
        return scope.formatRange({
          FONT_SIZE: parseInt(size),
        })
      }
      _horizontalAlignmentClick = function(evt) {
        return scope.formatRange({
          ALIGNMENT_HORIZONTAL: evt.target.dataset.value,
        })
      }
      _verticalAlignmentClick = function(evt) {
        return scope.formatRange({
          ALIGNMENT_VERTICAL: evt.target.dataset.value,
        })
      }
      _dataFormatsClick = function(evt) {
        var elementFormat
        elementFormat = evt.target.dataset.value || evt.target.parentElement.dataset.value
        return scope.formatRange({
          NUMFMT_FORMAT_CODE: elementFormat,
        })
      }

      function _mouseOverHandler(evt) {
        //SVGElements in IE11 (maybe others) do not support parentElement so we need to use
        //parentNode (UXBI-5149)

        // I think we can reasonably assume that any element which has this handler attached,
        // its parent will be an element and not something like CDATA or text
        const parent = evt.target.parentNode

        if (!parent) {
          return
        }

        // TODO: Cleanup handler to only get called on clipboard element hover
        if (parent.classList.contains('select')) {
          parent.classList.add('hover')
        } else {
          parent.parentNode.classList.add('hover')
        }
      }

      function _mouseOutHandler(evt) {
        // See _mouseOverHandler for comments about parentElement vs. parentNode
        const parent = evt.target.parentNode

        if (!parent) {
          return
        }
        // TODO: Cleanup handler to only get called on clipboard element hover
        if (parent.classList.contains('select')) {
          parent.classList.remove('hover')
        } else {
          parent.parentNode.classList.remove('hover')
        }
      }

      _toggleHandlers = function(active) {
        var operation
        operation = active ? 'on' : 'off'
        events[operation](element.querySelector('.horizontal-alignment > .dropdown-menu'), 'click', 'li > a', _horizontalAlignmentClick)
        events[operation](element.querySelector('.vertical-alignment > .dropdown-menu'), 'click', 'li > a', _verticalAlignmentClick)
        events[operation](element.querySelector('.format-dropdown-menu'), 'click', 'li > a', _dataFormatsClick)
        events[operation](element, 'mouseover', '.gc-dropdown-toggle', _mouseOverHandler)
        return events[operation](element, 'mouseout', '.gc-dropdown-toggle', _mouseOutHandler)
      }
      _attachHandlers = function() {
        return _toggleHandlers(true)
      }
      _removeHandlers = function() {
        return _toggleHandlers(false)
      }
      scope.$watch('pasteBuffer', function(buffer) {
        var action
        action = buffer ? 'removeAttribute' : 'setAttribute'
        return [].forEach.call(element.querySelectorAll('.clipboard .paste button'), function(pb) {
          return pb[action]('disabled', true)
        })
      })
      _attachHandlers()
      return scope.$on('$destroy', function() {
        _removeHandlers()
        scope.fontColorPicker.dispose()
        return scope.backgroundColorPicker.dispose()
      })
    },
  }
})
