/**
 * angular-drag-and-drop-lists v1.4.0
 *
 * Copyright (c) 2014 Marcel Juenemann marcel@juenemann.cc
 * Copyright (c) 2014-2016 Google Inc.
 * https://github.com/marceljuenemann/angular-drag-and-drop-lists
 *
 * License: MIT
 */
(function(dndLists) {

  /**
   * Use the dnd-draggable attribute to make your element draggable
   *
   * Attributes:
   * - dnd-draggable      Required attribute. The value has to be an object that represents the data
   *                      of the element. In case of a drag and drop operation the object will be
   *                      serialized and unserialized on the receiving end.
   * - dnd-selected       Callback that is invoked when the element was clicked but not dragged.
   *                      The original click event will be provided in the local event variable.
   * - dnd-effect-allowed Use this attribute to limit the operations that can be performed. Options:
   *                      - "move": The drag operation will move the element. This is the default.
   *                      - "copy": The drag operation will copy the element. Shows a copy cursor.
   *                      - "copyMove": The user can choose between copy and move by pressing the
   *                        ctrl or shift key. *Not supported in IE:* In Internet Explorer this
   *                        option will be the same as "copy". *Not fully supported in Chrome on
   *                        Windows:* In the Windows version of Chrome the cursor will always be the
   *                        move cursor. However, when the user drops an element and has the ctrl
   *                        key pressed, we will perform a copy anyways.
   *                      - HTML5 also specifies the "link" option, but this library does not
   *                        actively support it yet, so use it at your own risk.
   * - dnd-moved          Callback that is invoked when the element was moved. Usually you will
   *                      remove your element from the original list in this callback, since the
   *                      directive is not doing that for you automatically. The original dragend
   *                      event will be provided in the local event variable.
   * - dnd-canceled       Callback that is invoked if the element was dragged, but the operation was
   *                      canceled and the element was not dropped. The original dragend event will
   *                      be provided in the local event variable.
   * - dnd-copied         Same as dnd-moved, just that it is called when the element was copied
   *                      instead of moved. The original dragend event will be provided in the local
   *                      event variable.
   * - dnd-dragstart      Callback that is invoked when the element was dragged. The original
   *                      dragstart event will be provided in the local event variable.
   * - dnd-dragend        Callback that is invoked when the drag operation ended. Available local
   *                      variables are event and dropEffect.
   * - dnd-type           Use this attribute if you have different kinds of items in your
   *                      application and you want to limit which items can be dropped into which
   *                      lists. Combine with dnd-allowed-types on the dnd-list(s). This attribute
   *                      should evaluate to a string, although this restriction is not enforced.
   * - dnd-disable-if     You can use this attribute to dynamically disable the draggability of the
   *                      element. This is useful if you have certain list items that you don't want
   *                      to be draggable, or if you want to disable drag & drop completely without
   *                      having two different code branches (e.g. only allow for admins).
   *                      **Note**: If your element is not draggable, the user is probably able to
   *                      select text or images inside of it. Since a selection is always draggable,
   *                      this breaks your UI. You most likely want to disable user selection via
   *                      CSS (see user-select).
   *
   * CSS classes:
   * - dndDragging        This class will be added to the element while the element is being
   *                      dragged. It will affect both the element you see while dragging and the
   *                      source element that stays at it's position. Do not try to hide the source
   *                      element with this class, because that will abort the drag operation.
   * - dndDraggingSource  This class will be added to the element after the drag operation was
   *                      started, meaning it only affects the original element that is still at
   *                      it's source position, and not the "element" that the user is dragging with
   *                      his mouse pointer.
   */
  dndLists.directive('dndDraggable', ['$parse', '$timeout', function($parse, $timeout) {
    return function(scope, element, attr) {
      // Set the HTML5 draggable attribute on the element.
      element.attr("draggable", "true");

      // If the dnd-disable-if attribute is set, we have to watch that.
      if (attr.dndDisableIf) {
        scope.$watch(attr.dndDisableIf, function(disabled) {
          element.attr("draggable", !disabled);
        });
      }

      /**
       * When the drag operation is started we have to prepare the dataTransfer object,
       * which is the primary way we communicate with the target element
       */
      element.on('dragstart', function(event) {
        event = event.originalEvent || event;

        // Check whether the element is draggable, since dragstart might be triggered on a child.
        if (element.attr('draggable') == 'false') return true;

        // Serialize the data associated with this element. IE only supports the Text drag type.
        event.dataTransfer.setData("Text", angular.toJson(scope.$eval(attr.dndDraggable)));

        // Only allow actions specified in dnd-effect-allowed attribute.
        event.dataTransfer.effectAllowed = attr.dndEffectAllowed || "move";

        // Add CSS classes. See documentation above.
        element.addClass("dndDragging");
        $timeout(function() { element.addClass("dndDraggingSource"); }, 0);

        // Try setting a proper drag image if triggered on a dnd-handle (won't work in IE).
        if (event._dndHandle && event.dataTransfer.setDragImage) {
          event.dataTransfer.setDragImage(element[0], 0, 0);
        }

        // Initialize global state and invoke the callback.
        dndState.dragType = attr.dndType ? scope.$eval(attr.dndType) : undefined;
        dndState.dropEffect = "none";
        dndState.isDragging = true;
        $parse(attr.dndDragstart)(scope, {event: event});

        event.stopPropagation();
      });

      /**
       * The dragend event is triggered when the element was dropped or when the drag
       * operation was aborted (e.g. hit escape button). Depending on the executed action
       * we will invoke the callbacks specified with the dnd-moved or dnd-copied attribute.
       */
      element.on('dragend', function(event) {
        event = event.originalEvent || event;

        // Invoke callbacks. Usually we would use event.dataTransfer.dropEffect to determine
        // the used effect, but Chrome has not implemented that field correctly. On Windows
        // it always sets it to 'none', while Chrome on Linux sometimes sets it to something
        // else when it's supposed to send 'none' (drag operation aborted).
        var dropEffect = dndState.dropEffect;
        scope.$apply(function() {
          switch (dropEffect) {
            case "move":
              $parse(attr.dndMoved)(scope, {event: event});
              break;
            case "copy":
              $parse(attr.dndCopied)(scope, {event: event});
              break;
            case "none":
              $parse(attr.dndCanceled)(scope, {event: event});
              break;
          }
          $parse(attr.dndDragend)(scope, {event: event, dropEffect: dropEffect});
        });

        // Clean up
        element.removeClass("dndDragging");
        $timeout(function() { element.removeClass("dndDraggingSource"); }, 0);
        dndState.isDragging = false;
        event.stopPropagation();
      });

      /**
       * When the element is clicked we invoke the callback function
       * specified with the dnd-selected attribute.
       */
      element.on('click', function(event) {
        if (!attr.dndSelected) return;

        event = event.originalEvent || event;
        scope.$apply(function() {
          $parse(attr.dndSelected)(scope, {event: event});
        });

        // Prevent triggering dndSelected in parent elements.
        event.stopPropagation();
      });

      /**
       * Workaround to make element draggable in IE9
       */
      element.on('selectstart', function() {
        if (this.dragDrop) this.dragDrop();
      });
    };
  }]);

  /**
   * Use the dnd-list attribute to make your list element a dropzone. Usually you will add a single
   * li element as child with the ng-repeat directive. If you don't do that, we will not be able to
   * position the dropped element correctly. If you want your list to be sortable, also add the
   * dnd-draggable directive to your li element(s). Both the dnd-list and it's direct children must
   * have position: relative CSS style, otherwise the positioning algorithm will not be able to
   * determine the correct placeholder position in all browsers.
   *
   * Attributes:
   * - dnd-list             Required attribute. The value has to be the array in which the data of
   *                        the dropped element should be inserted.
   * - dnd-allowed-types    Optional array of allowed item types. When used, only items that had a
   *                        matching dnd-type attribute will be dropable.
   * - dnd-disable-if       Optional boolean expresssion. When it evaluates to true, no dropping
   *                        into the list is possible. Note that this also disables rearranging
   *                        items inside the list.
   * - dnd-horizontal-list  Optional boolean expresssion. When it evaluates to true, the positioning
   *                        algorithm will use the left and right halfs of the list items instead of
   *                        the upper and lower halfs.
   * - dnd-dragover         Optional expression that is invoked when an element is dragged over the
   *                        list. If the expression is set, but does not return true, the element is
   *                        not allowed to be dropped. The following variables will be available:
   *                        - event: The original dragover event sent by the browser.
   *                        - index: The position in the list at which the element would be dropped.
   *                        - type: The dnd-type set on the dnd-draggable, or undefined if unset.
   *                        - external: Whether the element was dragged from an external source.
   * - dnd-drop             Optional expression that is invoked when an element is dropped on the
   *                        list. The following variables will be available:
   *                        - event: The original drop event sent by the browser.
   *                        - index: The position in the list at which the element would be dropped.
   *                        - item: The transferred object.
   *                        - type: The dnd-type set on the dnd-draggable, or undefined if unset.
   *                        - external: Whether the element was dragged from an external source.
   *                        The return value determines the further handling of the drop:
   *                        - false: The drop will be canceled and the element won't be inserted.
   *                        - true: Signalises that the drop is allowed, but the dnd-drop
   *                          callback already took care of inserting the element.
   *                        - otherwise: All other return values will be treated as the object to
   *                          insert into the array. In most cases you want to simply return the
   *                          item parameter, but there are no restrictions on what you can return.
   * - dnd-inserted         Optional expression that is invoked after a drop if the element was
   *                        actually inserted into the list. The same local variables as for
   *                        dnd-drop will be available. Note that for reorderings inside the same
   *                        list the old element will still be in the list due to the fact that
   *                        dnd-moved was not called yet.
   * - dnd-external-sources Optional boolean expression. When it evaluates to true, the list accepts
   *                        drops from sources outside of the current browser tab. This allows to
   *                        drag and drop accross different browser tabs. Note that this will allow
   *                        to drop arbitrary text into the list, thus it is highly recommended to
   *                        implement the dnd-drop callback to check the incoming element for
   *                        sanity. Furthermore, the dnd-type of external sources can not be
   *                        determined, therefore do not rely on restrictions of dnd-allowed-type.
   *
   * CSS classes:
   * - dndPlaceholder       When an element is dragged over the list, a new placeholder child
   *                        element will be added. This element is of type li and has the class
   *                        dndPlaceholder set. Alternatively, you can define your own placeholder
   *                        by creating a child element with dndPlaceholder class.
   * - dndDragover          Will be added to the list while an element is dragged over the list.
   */
  dndLists.directive('dndList', ['$parse', function($parse) {
    return function(scope, element, attr) {
      // While an element is dragged over the list, this placeholder element is inserted
      // at the location where the element would be inserted after dropping
      var placeholder = getPlaceholderElement();
      var placeholderNode = placeholder[0];
      var listNode = element[0];
      placeholder.remove();

      var horizontal = attr.dndHorizontalList && scope.$eval(attr.dndHorizontalList);
      var externalSources = attr.dndExternalSources && scope.$eval(attr.dndExternalSources);

      /**
       * The dragenter event is fired when a dragged element or text selection enters a valid drop
       * target. According to the spec, we either need to have a dropzone attribute or listen on
       * dragenter events and call preventDefault(). It should be noted though that no browser seems
       * to enforce this behaviour.
       */
      element.on('dragenter', function (event) {
        event = event.originalEvent || event;
        if (!isDropAllowed(event)) return true;
        event.preventDefault();
      });

      /**
       * The dragover event is triggered "every few hundred milliseconds" while an element
       * is being dragged over our list, or over an child element.
       */
      element.on('dragover', function(event) {
        event = event.originalEvent || event;

        if (!isDropAllowed(event)) return true;

        // Make sure the placeholder is shown, which is especially important if the list is empty.
        if (placeholderNode.parentNode != listNode) {
          element.append(placeholder);
          // In nested lists, the parent list might be showing a placeholder that we have to remove.
          if (dndState.onNewDropTarget && dndState.onNewDropTarget != stopDragover) {
            dndState.onNewDropTarget();
          }
          dndState.onNewDropTarget = stopDragover;
        }

        if (event.target != listNode) {
          // Try to find the node direct directly below the list node.
          var listItemNode = event.target;
          while (listItemNode.parentNode != listNode && listItemNode.parentNode) {
            listItemNode = listItemNode.parentNode;
          }

          if (listItemNode.parentNode == listNode && listItemNode != placeholderNode) {
            // If the mouse pointer is in the upper half of the list item element,
            // we position the placeholder before the list item, otherwise after it.
            var rect = listItemNode.getBoundingClientRect();
            if (horizontal) {
              var isFirstHalf = event.clientX < rect.left + rect.width / 2;
            } else {
              var isFirstHalf = event.clientY < rect.top + rect.height / 2;
            }
            listNode.insertBefore(placeholderNode,
                isFirstHalf ? listItemNode : listItemNode.nextSibling);
          }
        }

        // At this point we invoke the callback, which still can disallow the drop.
        // We can't do this earlier because we want to pass the index of the placeholder.
        if (attr.dndDragover && !invokeCallback(attr.dndDragover, event, getPlaceholderIndex())) {
          return stopDragover();
        }

        element.addClass("dndDragover");
        event.preventDefault();
        event.stopPropagation();
        return false;
      });

      /**
       * When the element is dropped, we use the position of the placeholder element as the
       * position where we insert the transferred data. This assumes that the list has exactly
       * one child element per array element.
       */
      element.on('drop', function(event) {
        event = event.originalEvent || event;

        if (!isDropAllowed(event)) return true;

        // The default behavior in Firefox is to interpret the dropped element as URL and
        // forward to it. We want to prevent that even if our drop is aborted.
        event.preventDefault();

        // Unserialize the data that was serialized in dragstart. According to the HTML5 specs,
        // the "Text" drag type will be converted to text/plain, but IE does not do that.
        var data = event.dataTransfer.getData("Text") || event.dataTransfer.getData("text/plain");
        var transferredObject;
        try {
          transferredObject = JSON.parse(data);
        } catch(e) {
          return stopDragover();
        }

        // Invoke the callback, which can transform the transferredObject and even abort the drop.
        var index = getPlaceholderIndex();
        if (attr.dndDrop) {
          transferredObject = invokeCallback(attr.dndDrop, event, index, transferredObject);
          if (!transferredObject) {
            return stopDragover();
          }
        }

        // Insert the object into the array, unless dnd-drop took care of that (returned true).
        if (transferredObject !== true) {
          scope.$apply(function() {
            scope.$eval(attr.dndList).splice(index, 0, transferredObject);
          });
        }
        invokeCallback(attr.dndInserted, event, index, transferredObject);

        // In Chrome on Windows the dropEffect will always be none...
        // We have to determine the actual effect manually from the allowed effects
        if (event.dataTransfer.dropEffect === "none") {
          if (event.dataTransfer.effectAllowed === "copy" ||
              event.dataTransfer.effectAllowed === "move") {
            dndState.dropEffect = event.dataTransfer.effectAllowed;
          } else {
            dndState.dropEffect = event.ctrlKey ? "copy" : "move";
          }
        } else {
          dndState.dropEffect = event.dataTransfer.dropEffect;
        }

        // Clean up
        stopDragover();
        event.stopPropagation();
        return false;
      });

      /**
       * We have to remove the placeholder when the element is no longer dragged over our list. The
       * problem is that the dragleave event is not only fired when the element leaves our list,
       * but also when it leaves a child element. As a workaround we check which element is below
       * the mouse pointer, and whether it is a descendant. Note that this will not take care of
       * the case where the drop target was moved to a child dnd-list. That will be handled by
       * the dragover handler.
       */
      element.on('dragleave', function(event) {
        event = event.originalEvent || event;
        var newTarget = document.elementFromPoint(event.clientX, event.clientY);
        if (!listNode.contains(newTarget)) {
          stopDragover();
        }
      });

      /**
       * Tries to find a child element that has the dndPlaceholder class set. If none was found, a
       * new li element is created.
       */
      function getPlaceholderElement() {
        var placeholder;
        angular.forEach(element.children(), function(childNode) {
          var child = angular.element(childNode);
          if (child.hasClass('dndPlaceholder')) {
            placeholder = child;
          }
        });
        return placeholder || angular.element("<li class='dndPlaceholder'></li>");
      }

      /**
       * We use the position of the placeholder node to determine at which position of the array the
       * object needs to be inserted
       */
      function getPlaceholderIndex() {
        return Array.prototype.indexOf.call(listNode.children, placeholderNode);
      }

      /**
       * Checks various conditions that must be fulfilled for a drop to be allowed
       */
      function isDropAllowed(event) {
        // Disallow drop from external source unless it's allowed explicitly.
        if (!dndState.isDragging && !externalSources) return false;

        // Check mimetype. Usually we would use a custom drag type instead of Text, but IE doesn't
        // support that.
        if (!hasTextMimetype(event.dataTransfer.types)) return false;

        // Now check the dnd-allowed-types against the type of the incoming element. For drops from
        // external sources we don't know the type, so it will need to be checked via dnd-drop.
        if (attr.dndAllowedTypes && dndState.isDragging) {
          var allowed = scope.$eval(attr.dndAllowedTypes);
          if (angular.isArray(allowed) && allowed.indexOf(dndState.dragType) === -1) {
            return false;
          }
        }

        // Check whether droping is disabled completely
        if (attr.dndDisableIf && scope.$eval(attr.dndDisableIf)) return false;

        return true;
      }

      /**
       * Small helper function that cleans up if we aborted a drop.
       */
      function stopDragover() {
        placeholder.remove();
        element.removeClass("dndDragover");
        return true;
      }

      /**
       * Invokes a callback with some interesting parameters and returns the callbacks return value.
       */
      function invokeCallback(expression, event, index, item) {
        return $parse(expression)(scope, {
          event: event,
          index: index,
          item: item || undefined,
          external: !dndState.isDragging,
          type: dndState.isDragging ? dndState.dragType : undefined
        });
      }

      /**
       * Check if the dataTransfer object contains a drag type that we can handle. In old versions
       * of IE the types collection will not even be there, so we just assume a drop is possible.
       */
      function hasTextMimetype(types) {
        if (!types) return true;
        for (var i = 0; i < types.length; i++) {
          if (types[i] === "Text" || types[i] === "text/plain") return true;
        }
        return false;
      }
    };
  }]);

  /**
   * Use the dnd-nodrag attribute inside of dnd-draggable elements to prevent them from starting
   * drag operations. This is especially useful if you want to use input elements inside of
   * dnd-draggable elements or create specific handle elements. Note: This directive does not work
   * in Internet Explorer 9.
   */
  dndLists.directive('dndNodrag', function() {
    return function(scope, element, attr) {
      // Set as draggable so that we can cancel the events explicitly
      element.attr("draggable", "true");

      /**
       * Since the element is draggable, the browser's default operation is to drag it on dragstart.
       * We will prevent that and also stop the event from bubbling up.
       */
      element.on('dragstart', function(event) {
        event = event.originalEvent || event;

        if (!event._dndHandle) {
          // If a child element already reacted to dragstart and set a dataTransfer object, we will
          // allow that. For example, this is the case for user selections inside of input elements.
          if (!(event.dataTransfer.types && event.dataTransfer.types.length)) {
            event.preventDefault();
          }
          event.stopPropagation();
        }
      });

      /**
       * Stop propagation of dragend events, otherwise dnd-moved might be triggered and the element
       * would be removed.
       */
      element.on('dragend', function(event) {
        event = event.originalEvent || event;
        if (!event._dndHandle) {
          event.stopPropagation();
        }
      });
    };
  });

  /**
   * Use the dnd-handle directive within a dnd-nodrag element in order to allow dragging with that
   * element after all. Therefore, by combining dnd-nodrag and dnd-handle you can allow
   * dnd-draggable elements to only be dragged via specific "handle" elements. Note that Internet
   * Explorer will show the handle element as drag image instead of the dnd-draggable element. You
   * can work around this by styling the handle element differently when it is being dragged. Use
   * the CSS selector .dndDragging:not(.dndDraggingSource) [dnd-handle] for that.
   */
  dndLists.directive('dndHandle', function() {
    return function(scope, element, attr) {
      element.attr("draggable", "true");

      element.on('dragstart dragend', function(event) {
        event = event.originalEvent || event;
        event._dndHandle = true;
      });
    };
  });

  /**
   * For some features we need to maintain global state. This is done here, with these fields:
   * - dragType: Set in dragstart. In Internet Explorer we can't pass the dnd-type in the mime type,
   *   or at least not read it out during dragover. Therefore, we save it here as well.
   * - dropEffect: Set in dragstart to "none" and to the actual value in the drop handler. We don't
   *   rely on the dropEffect passed by the browser, since there are various bugs in Chrome and
   *   Safari, and Internet Explorer defaults to copy if effectAllowed is copyMove.
   * - isDragging: True between dragstart and dragend. Falsy for drops from external sources.
   * - onNewDropTarget: Callback managed by the dragover handler to remove parent placeholders.
   */
  var dndState = {};

})(angular.module('dndLists', []));
