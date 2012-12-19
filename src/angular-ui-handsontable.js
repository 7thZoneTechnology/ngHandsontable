angular.module('uiHandsontable', [])
  .directive('uiHandsontable', function () {
    var directiveDefinitionObject = {
      restrict: 'EA',
      compile: function compile(tElement, tAttrs, transclude) {

        var defaultSettings = {
          outsideClickDeselects: false,
          autoComplete: []
        };

        var $container = $('<div class="ui-handsontable-container"></div>');

        var expression = tAttrs.datarows;
        var match = expression.match(/^\s*(.+)\s+in\s+(.*)\s*$/),
          lhs, rhs;
        if (!match) {
          throw Error("Expected datarows in form of '_item_ in _collection_' but got '" +
            expression + "'.");
        }
        lhs = match[1];
        rhs = match[2];
        tElement.data("uiDatagrid", {
          lhs: lhs,
          rhs: rhs,
          colHeaders: [],
          colWidths: [],
          columns: [],
          settings: angular.extend({}, defaultSettings),
          $container: $container
        });

        return function postLink(scope, element, attrs, controller) {
          var uiDatagrid = element.data("uiDatagrid");
          uiDatagrid.settings = angular.extend(uiDatagrid.settings, scope.$eval(attrs.uiHandsontable || attrs.settings));

          $(element).append($container);

          if (typeof scope[rhs] !== 'undefined') {
            uiDatagrid.settings['data'] = scope[rhs];
            if (uiDatagrid.columns.length > 0) {
              uiDatagrid.settings['columns'] = uiDatagrid.columns;
            }
          }

          if (uiDatagrid.colHeaders.length > 0) {
            uiDatagrid.settings['colHeaders'] = uiDatagrid.colHeaders;
          }

          if (uiDatagrid.colWidths.length > 0) {
            uiDatagrid.settings['colWidths'] = uiDatagrid.colWidths;
          }

          $container.handsontable(uiDatagrid.settings);

          $container.on('datachange.handsontable', function (event, changes, source) {
            if (!scope.$$phase) { //if digest is not in progress
              scope.$apply(); //programmatic change does not trigger digest in AnuglarJS so we need to trigger it automatically
            }
          });

          $container.on('selectionbyprop.handsontable', function (event, r, p, r2, p2) {
            scope.$emit('datagridSelection', $container, r, p, r2, p2);
          });

          // set up watchers for visible part of the table
          scope.$watch(function () {
            //check if visible data has changed
            var out = ''
              , instance = $container.data('handsontable')
              , clen = instance.countCols();
            for (var r = instance.rowOffset(), rlen = r + instance.countVisibleRows(); r < rlen; r++) {
              for (var c = 0; c < clen; c++) {
                out += instance.getDataAtCell(r, c)
              }
            }
            return out;
          }, function (newVal, oldVal) {
            //if data has changed, render the table
            if (newVal === oldVal) {
              return;
            }
            if (scope[rhs] !== $container.handsontable('getData') && uiDatagrid.columns.length > 0) {
              $container.handsontable('updateSettings', {
                data: scope[rhs],
                columns: uiDatagrid.columns
              });
            }
            else {
              $container.handsontable('render', scope[rhs]); //never goes here really, fix this
            }
          }, false);
        }
      }
    };
    return directiveDefinitionObject;
  })
  .directive('datacolumn', function () {
    var directiveDefinitionObject = {
      restrict: 'E',
      priority: 500,
      compile: function compile(tElement, tAttrs, transclude) {

        var keys = [];
        for (var i in tAttrs) {
          if (tAttrs.hasOwnProperty(i)) {
            keys.push(i);
          }
        }

        tElement.data("uiDatagridAutocomplete", {
          value: tAttrs.value,
          source: null,
          saveOnBlur: ($.inArray('saveonblur', keys) !== -1), //true if element has attribute 'saveonblur'
          strict: ($.inArray('strict', keys) !== -1) //true if element has attribute 'strict'
        });

        return function postLink(scope, element, attrs, controller) {
          var i;
          var uiDatagrid = element.inheritedData("uiDatagrid");

          var pattern = new RegExp("^(" + uiDatagrid.lhs + "\\.)")
            , value = attrs.value.replace(pattern, '')
            , title = scope.$eval(attrs.title)
            , width = scope.$eval(attrs.width)
            , type = scope.$eval(attrs.type)
            , options = attrs.options
            , tmp;

          var childScope = scope.$new();

          var column = scope.$eval(options) || {};
          column.data = value;

          uiDatagrid.colHeaders.push(title);
          uiDatagrid.colWidths.push(width);

          switch (type) {
            case 'autocomplete':
              column.type = Handsontable.AutocompleteCell;
              var uiDatagridAutocomplete = element.data("uiDatagridAutocomplete");
              for (i in uiDatagridAutocomplete) {
                if (uiDatagridAutocomplete.hasOwnProperty(i)) {
                  column[i] = uiDatagridAutocomplete[i];
                }
              }
              break;

            case 'checkbox':
              column.type = Handsontable.CheckboxCell;
              tmp = attrs.checkedtemplate;
              if (typeof tmp !== 'undefined') {
                column.checkedTemplate = scope.$eval(tmp); //if undefined then defaults to Boolean true
              }
              tmp = attrs.uncheckedtemplate;
              if (typeof tmp !== 'undefined') {
                column.uncheckedTemplate = scope.$eval(tmp); //if undefined then defaults to Boolean true
              }
              break;

            default:
              if (typeof type === 'object') {
                column.type = type;
              }
          }

          if (typeof attrs.readonly !== 'undefined') {
            column.readOnly = true;
          }

          for (i in attrs) {
            if (attrs.hasOwnProperty(i) && i.charAt(0) !== '$' && typeof column[i] === 'undefined') {
              column[i] = childScope.$eval(attrs[i]);
            }
          }

          uiDatagrid.columns.push(column);
        }
      }
    };
    return directiveDefinitionObject;
  })
  .directive('optionlist', function () {
    var directiveDefinitionObject = {
      restrict: 'E',
      transclude: 'element',
      priority: 510,
      compile: function compile(element, attr, linker) {

        return function postLink(scope, element, attrs, controller) {
          var uiDatagridAutocomplete = element.inheritedData("uiDatagridAutocomplete");
          var uiDatagrid = element.inheritedData("uiDatagrid");

          var expression = attrs.datarows;
          var match = expression.match(/^\s*(.+)\s+in\s+(.*)\s*$/),
            lhs, rhs;
          if (!match) {
            throw Error("Expected datarows in form of '_item_ in _collection_' but got '" +
              expression + "'.");
          }
          lhs = match[1];
          rhs = match[2];

          var deregister
            , deinterval;

          var childScope = scope.$new();

          var lastItems;
          var lastQuery;

          uiDatagridAutocomplete.source = function (query, process) {
            if ($.trim(query) === lastQuery) {
              return;
            }
            lastQuery = $.trim(query);

            if (deregister) {
              deregister();
              clearInterval(deinterval);
            }
            var row = uiDatagrid.$container.data('handsontable').getSelected()[0];
            childScope[uiDatagrid.lhs] = scope.$eval(uiDatagrid.rhs)[row];
            if (!uiDatagridAutocomplete.saveOnBlur) {
              childScope.$eval(uiDatagridAutocomplete.value + ' = "' + $.trim(query).replace(/"/g, '\"') + '"'); //refresh value after each key stroke
              childScope.$apply();
            }
            deinterval = setInterval(function () {
              childScope.item = uiDatagrid.$container.data('handsontable').getData()[row];
              if (childScope.item) {
                childScope.$apply();
              }
              else {
                deregister();
                clearInterval(deinterval);
              }
            }, 100);
            deregister = childScope.$watch(rhs, function (newVal) {
              lastItems = newVal;
              if (process) {
                process(newVal);
              }
            }, true);
          };

          uiDatagridAutocomplete.sorter = function (items) {
            return items;
          };

          uiDatagridAutocomplete.highlighter = function (item) {
            var el;
            var optionScope = childScope.$new();
            optionScope[lhs] = item;
            linker(optionScope, function (elem) {
              el = elem[0];
              el.style.display = 'block';
            });
            return el;
          };

          uiDatagridAutocomplete.select = function () {
            var instance = uiDatagrid.$container.data('handsontable');
            if (this.$menu.find('.active').length) {
              var index = this.$menu.find('.active').index();
              childScope[lhs] = lastItems[index];
              instance.destroyEditor();
              childScope.$eval(attrs.clickrow);
            }
            else if (!uiDatagridAutocomplete.strict) {
              instance.destroyEditor();
              childScope.$eval(uiDatagridAutocomplete.value + ' = "' + $.trim(this.query).replace(/"/g, '\"') + '"'); //assign current textarea value
            }
            //instance.render();
            $('.handsontable').each(function () {
              $(this).handsontable('render');//render all Handsontables in the page
            });

            lastQuery = void 0;
            return this.hide();
          };
        }
      }
    };
    return directiveDefinitionObject;
  });