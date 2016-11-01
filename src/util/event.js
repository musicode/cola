
import {
  isArray,
  isString,
  isFunction,
} from './is'

import {
  each as eachArray,
  hasItem,
  removeItem,
} from './array'

import {
  each as eachObject
} from './object'

export class Event {

  constructor(event) {
    if (event.type) {
      this.type = event.type
      this.originalEvent = event
    }
    else {
      this.type = event
    }
    this.timestamp = Date.now()
  }

  preventDefault() {
    if (!this.isDefaultPrevented) {
      let { originalEvent } = this
      if (originalEvent && isFunction(originalEvent.preventDefault)) {
        originalEvent.preventDefault()
      }
      this.isDefaultPrevented = true
    }
  }

  stopPropagation() {
    if (!this.isPropagationStoped) {
      let { originalEvent } = this
      if (originalEvent && isFunction(originalEvent.stopPropagation)) {
        originalEvent.stopPropagation()
      }
      this.isPropagationStoped = true
    }
  }

}

export class Emitter {

  constructor() {
    this.listeners = { }
  }

  on(type, listener) {
    let { listeners } = this
    let list = listeners[type] || (listeners[type] = [])
    list.push(listener)
  }

  once(type, listener) {
    let me = this
    listener.$once = function () {
      me.off(type, listener)
      delete listener.$once
    }
    me.on(type, listener)
  }

  off(type, listener) {
    let { listeners } = this
    if (type == null) {
      eachObject(listeners, function (list, type) {
        if (isArray(listeners[type])) {
          listeners[type].length = 0
        }
      })
    }
    else {
      let list = listeners[type]
      if (isArray(list)) {
        if (listener == null) {
          list.length = 0
        }
        else {
          removeItem(list, listener)
        }
      }
    }
  }

  fire(type, data, context = null) {

    let list = this.listeners[type]
    if (isArray(list)) {
      eachArray(list, function (listener) {
        let result = listener.apply(context, data)

        let { $once } = listener
        if (isFunction($once)) {
          $once()
        }

        // 如果没有返回 false，而是调用了 event.stopPropagation 也算是返回 false
        let event = data[0]
        if (event && event instanceof Event) {
          if (result === false) {
            event.preventDefault()
            event.stopPropagation()
          }
          else if (event.isPropagationStoped) {
            result = false
          }
        }

        if (result === false) {
          return result
        }
      })
    }

  }

  has(type, listener) {

    let list = this.listeners[type]
    if (listener == null) {
      return isArray(list) && list.length > 0
    }

    return isArray(list)
      ? hasItem(list, listener)
      : false

  }
}
