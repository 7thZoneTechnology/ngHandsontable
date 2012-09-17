angular.module('StarcounterLib', [])
  .directive('uiDatagrid', function () {
    var directiveDefinitionObject = {
      restrict:'A',
      require:'ngModel',
      compile:function compile(tElement, tAttrs, transclude) {

        var $container = $('<div class="dataTable"></div>');

        return function postLink(scope, element, attrs, controller) {
          //console.log('postLink', transclude, element);

          $(element).append($container);

          var columns = [];
          var colHeaders = [];
          var colToProp = [];
          var propToCol = {};
          var i = 0;
          $(element).find('datacolumn').each(function () {
            var name = $(this).attr('name');
            var title = $(this).attr('title');
            columns.push({data:name});
            colToProp[i] = name;
            propToCol[name] = i;
            colHeaders.push(title);
          });

          var options = {
            rows:6,
            cols:3,
            outsideClickDeselects:false
          };

          if (columns.length > 0) {
            options['columns'] = columns;
          }

          if (colHeaders.length > 0) {
            options['colHeaders'] = colHeaders;
          }

          $container.handsontable(options);

          $container.on('datachange.handsontable', function (event, changes, source) {
            if (source === 'loadData') {
              return;
            }
            scope.$apply(function () {
              scope.dataChange = !scope.dataChange;
            });
          });

          $container.on('selectionbyprop.handsontable', function (event, r, c, r2, c2) {
            var oldSel = scope.selectionChange;
            var newSel = [r, c, r2, c2];
            if (typeof oldSel === 'undefined' || oldSel[0] != newSel[0] || oldSel[1] != newSel[1] || oldSel[2] != newSel[2] || oldSel[3] != newSel[3]) {
              scope.$apply(function () {
                scope.selectionChange = newSel;
              });
            }
          });

          scope.$watch('dataChange', function (value) {
            //console.log($(element).attr('id'), "triggered dataChange", value);
            $container.handsontable("loadData", scope[attrs.ngModel]);
            scope.$emit('broadcastItems');
          });

          scope.$watch('selectionChange', function (value) {
            //console.log($(element).attr('id'), "triggered selectionChange", value);
            if (value) {
              $container.handsontable("selectCellByProp", value[0], value[1], value[2], value[3]);
            }
          });

          scope.$on('incomingItems', function () {
            $container.handsontable("loadData", scope[attrs.ngModel]);
          });
        }
      }
    };
    return directiveDefinitionObject;
  });