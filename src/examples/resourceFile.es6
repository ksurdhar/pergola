import Range from 'common/factories/range'

import FileMixin from './fileMixin'
import ResourceFactory from './resource'

const Base = ResourceFactory('Region')

class Region extends Base {

  static create(params) {
    const defaults = {
      shared: false,
    }

    params = Object.assign(defaults, params)

    const region = new Region()

    params.name && (region.name = params.name)
    params.description && (region.description = params.description)

    return region.$save({
      range: params.range,
      regionShared: params.shared,
      sheetID: params.sheet.id,
    })
  }

  getFullAddress() {
    return this.fullAddress
  }

  setFullAddress(address) {
    this.fullAddress = address
  }

  markViewed() {
    return Base.socket(this._appendID({
      _type: 'Region.viewed',
    }))
  }

  splatIntoSheet(sheetID, rangeString) {
    const req = {
      _type: 'SheetEdit.splat',
      sheetID: sheetID,
      range: rangeString,
    }

    return Base.socket(this._appendID(req))
  }

  splatIntoWorkbook(workbookID, rangeString) {
    const req = {
      _type: 'SheetEdit.splat',
      workbookID: workbookID,
      range: rangeString,
    }

    return Base.socket(this._appendID(req))
  }

  exportHtml() {
    const url = `export/${this.id}?format=html`

    return Base.urlFor(url)
  }

  exportUrl(format='html') {
    const req = {
      _type: 'Exporter.exportToLocker',
      objectID: this.id,
      format: format,
    }

    return Base.socket(req).then((msg) => {
      msg.format = format
      return msg
    })
  }

  references() {
    const req = {
      _type: 'RegionReferences.get',
    }

    return Base.socket(this._appendID(req))
  }

}

Object.defineProperty(Region.prototype, 'ranges', {
  get: function() {
    if (!this._ranges) {
      this._ranges = []
      for (let range of this.regionRanges) {
        this._ranges.push(new Range(range))
      }
    }
    return this._ranges
  },
})

export default FileMixin(Region)
