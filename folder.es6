import FileFactory from './fileFactory'
import FileMixin from './fileMixin'
import ResourceFactory from './resource'

const Base = ResourceFactory('Folder')

class Folder extends Base {

  // Want to refactor this out but Folder <-> FolderChild concerns = circular dependencies :(
  static childEntity(child) {
    const refType = child.reference.referenceType
    const klass = refType === 'FOLDER' ? this : FileFactory(refType)

    child.reference.objectShared = child.shared
    child.reference.loadingProgress = child.reference.objectLoading
    child.reference.objectLastViewedDate = child.lastViewedDate
    child.reference.folderChildrenChanged = child.childrenChanged
    child.reference.subjects = child.subjects
    return Base._factory(child.reference, klass)
  }

  static children(cid, offset=0, count=100) {
    const req = {
      _type: 'FolderChildren.getAll',
      folderID: cid,
    }

    return Base.socket(req).then((response) => {
      const children = []
      for (let i = 0, length = response.children.length; i < length; i++) {
        children.push(Folder.childEntity(response.children[i]))
      }
      return children
    })
  }

  static create(params) {
    const folder = new Folder()

    params.name && (folder.name = params.name)
    params.description && (folder.description = params.description)

    return folder.$save({
      folderID: params.parentId,
    })
  }

  static deleteChildren(children) {
    const req = {
      _type: 'FolderChildren.delete',
      deleteIDs: children.map(child => child.id),
    }

    return Base.socket(req)
  }

  static undeleteChildren(children) {
    const req = {
      _type: 'FolderChildren.undelete',
      undeleteIDs: children.map(child => child.id),
    }

    return Base.socket(req)
  }

  static browse(path) {
    const req = {
      _type: 'Browse.get',
      path: path,
    }

    return Base.socket(req).then((response) => {
      const folders = []
      for (let i = 0, length = response.breadCrumbs.length; i < length; i++) {
        folders.push(Base._factory(response.breadCrumbs[i], this))
      }
      return folders
    })
  }

  static move(fid, newFolderID) {
    const req = {
      action: 'move',
      childID: fid,
      newFolderID: newFolderID,
    }

    return Base.socket(req)
  }

  children(offset=0, count=100) {
    Folder.children(this.id, offset, count)
  }

  deleteChildren(children) {
    Folder.deleteChildren(this.id, children)
  }

}

export default FileMixin(Folder)
