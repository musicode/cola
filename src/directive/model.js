
import {
  on,
  off,
} from '../native/dom/helper'

import {
  testKeypath,
} from '../util/component'

import {
  hasItem,
  removeItem,
} from '../util/array'

import {
  isArray,
  isNumeric,
} from '../util/is'

import debounce from '../function/debounce'

// 支持 input 事件的控件
const supportInputTypes = [ 'text', 'number', 'url', 'email', 'search' ]

// 特殊的双向绑定逻辑
const controlTypes = {
  normal: {
    set: function ({ el, keypath, instance }) {
      el.value = instance.get(keypath)
    },
    sync: function ({ el, keypath, instance }) {
      instance.set(keypath, el.value)
    }
  },
  radio: {
    set: function ({ el, keypath, instance }) {
      el.checked = el.value == instance.get(keypath)
    },
    sync: function ({ el, keypath, instance }) {
      if (el.checked) {
        instance.set(keypath, el.value)
      }
    }
  },
  checkbox: {
    set: function ({ el, keypath, instance }) {
      let value = instance.get(keypath)
      el.checked = isArray(value)
        ? hasItem(value, el.value, false)
        : !!value
    },
    sync: function ({ el, keypath, instance }) {
      let array = instance.get(keypath)
      if (isArray(array)) {
        if (el.checked) {
          array.push(el.value)
        }
        else {
          removeItem(array, el.value, false)
        }
        instance.set(keypath, [ ...array ])
      }
      else {
        instance.set(keypath, el.checked)
      }
    }
  }
}

module.exports = {

  attach: function ({ el, node, instance, directives }) {

    let eventName = 'change', eventInterval, value

    let { type, tagName } = el

    if (tagName === 'INPUT' && hasItem(supportInputTypes, type)
      || tagName === 'TEXTAREA'
    ) {
      let lazyDirective = directives.lazy
      if (lazyDirective) {
        value = lazyDirective.node.getValue()
        if (isNumeric(value) && value >= 0) {
          eventName = 'input'
          eventInterval = value
        }
      }
      else {
        eventName = 'input'
      }
    }

    value = node.getValue()

    let result = testKeypath(instance, node.keypath, value)
    if (!result) {
      throw new Error(`不能双向绑定到 ${keypath}`)
    }

    let { keypath } = result

    let target = controlTypes[type] || controlTypes.normal
    let data = {
      el,
      keypath,
      instance,
    }
    target.set(data)

    instance.watch(
      keypath,
      function () {
        target.set(data)
      }
    )

    let eventListener = function () {
      target.sync(data)
    }

    if (eventInterval) {
      eventListener = debounce(eventListener, eventInterval)
    }

    el.$model = {
      eventName,
      eventListener,
    }

    on(el, eventName, eventListener)

  },

  detach: function ({ el }) {
    let { $model } = el
    off(el, $model.eventName, $model.eventListener)
    el.$model = null
  }

}
