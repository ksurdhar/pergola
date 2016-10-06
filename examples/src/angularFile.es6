import angular from '@workday/angularjs'

import Range from 'common/factories/range'

import WorkbookRevision from 'common/resources/workbookRevision'
import WorkbookVersion from 'common/resources/workbookVersion'

import sheetMediator from 'common/services/sheetMediator'
import singletons from 'common/services/singletons'

const ngDeps = []

export default angular.module('directives.collaboration.revisions', ngDeps)
.directive('revisions', function() {
  return {
    replace: true,
    restrict: 'EA',
    template: require('./revisions.tpl.jade'),
    controller: function($scope) {
      'ngInject'

      const theSocket = singletons.get('socket')

      // Set versions to null, this will be changed to an array once we've fetched them
      $scope.versionsAndRevisions = null
      $scope.versions = []
      $scope.revisions = []

      const init = () => {
        if (!$scope.versionsAndRevisions) {
          $scope.fetchVersionsAndRevisions()
        }
      }

      const _buildVersionAndRevisionTree = function() {
        // Sort into data descending
        $scope.versionsAndRevisions = [].concat($scope.revisions, $scope.versions).sort(function(a, b) {
          return b.createdDate - a.createdDate
        })

        const versionsAndRevisions = $scope.versionsAndRevisions
        let currentVersion = null

        for (const item of versionsAndRevisions) {
          if (item instanceof WorkbookVersion) {
            currentVersion = item
            currentVersion.revisions = []
            currentVersion.open = true
          } else {
            if (currentVersion) {
              currentVersion.revisions.push(item)
              item.open = false
            } else {
              item.open = true
            }
          }
        }
      }

      $scope.fetchVersionsAndRevisions = function() {
        const workbookID = sheetMediator.getWorkbook().id

        const revisionPromise = WorkbookRevision.list(workbookID).then(function(revisions) {
          $scope.revisions = revisions
        })

        const versionPromise = WorkbookVersion.list(workbookID).then(function(versions) {
          $scope.versions = versions
        })

        // Build version -> revision association
        Promise.all([ revisionPromise, versionPromise ]).then(function() {
          $scope.$apply(function() {
            _buildVersionAndRevisionTree()
          })
        })
      }

      $scope.revertVersion = function(version) {
        let revision
        const vars = $scope.versionsAndRevisions
        const versionIdx = vars.indexOf(version)
        let revisionIdx = versionIdx + 1
        let results = []
        while (revisionIdx < vars.length) {
          if ((revision = vars[revisionIdx])) {
            if (revision.constructor === WorkbookRevision) {
              revision.revert()
              break
            }
          }
          results.push(revisionIdx++)
        }
        return results
      }

      /**
      * Life-cycle
      **/

      $scope.$on('$destroy', function() {
        theSocket.unsubscribe('_type', _revisionListener)
        theSocket.unsubscribe('_type', _versionListener)
      })

      const _revisionListener = theSocket.subscribe('_type', 'WorkbookRevision.revision', function(msg) {
        const revision = new WorkbookRevision(msg)
        $scope.revisions.unshift(revision)
        if (!revision.revertable) {
          for (const revision of $scope.revisions) {
            revision.revertable = false
          }
          for (const version of $scope.versions) {
            version.revertable = false
          }
        }
        $scope.$apply(function() {
          _buildVersionAndRevisionTree()
        })
      })

      const _versionListener = theSocket.subscribe('_type', 'WorkbookVersion.version', function(msg) {
        const version = new WorkbookVersion(msg)
        if (version.workbookID !== sheetMediator.getWorkbook().id) {
          return
        }
        $scope.versions.unshift(version)
        $scope.$apply(function() {
          _buildVersionAndRevisionTree()
        })
      })

      init()
    },
  }
}).directive('revisionItem', function() {
  return {
    replace: true,
    restrict: 'E',
    template: require('./revisionItem.tpl.jade'),
    scope: {
      item: '=',
    },

    controller: function($scope) {
      'ngInject'

      const theSession = singletons.get('session')

      $scope.currentUser = theSession.currentUser
      $scope.selectVersionOrRevision = function(item) {
        if (item.constructor.singular === 'revision') {
          if (item.messageReference) {
            const range = new Range(item.messageReference)
            sheetMediator.getActiveSheetController().highlightRange(range)
          }
        }
      }

      $scope.revertRevision = function(revision) {
        revision.revert()
      }

      $scope.revertVersion = function(version) {
        $scope.$parent.revertVersion(version)
      }

      $scope.toggle = function() {
        if ($scope.item.constructor.singular !== 'version') {
          return
        }
        const ref = $scope.item.revisions
        const len = ref.length
        let results = []
        for (let i = 0; i < len; i++) {
          const revision = ref[i]
          results.push(revision.open = !revision.open)
        }
        return results
      }

      $scope.$on('$destroy', function() {
        sheetMediator.getActiveSheetController().visibleRangeManager.clear()
      })
    },

    link: function($scope) {
      $scope.kind = $scope.item.constructor.singular
    },
  }
})
