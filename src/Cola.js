
import Mustache from './compiler/parser/Mustache'

import * as syntax from './config/syntax'
import * as lifecycle from './config/lifecycle'

import {
  Emitter,
} from './util/event'

import {
  getWildcardNames,
  getWildcardMatches,
} from './util/keypath'

import {
  has as objectHas,
  get as objectGet,
  set as objectSet,
  each as objectEach,
  count as objectCount,
  extend as objectExtend,
} from './util/object'

import {
  merge as mergeArray,
  hasItem,
  lastItem,
  removeItem,
} from './util/array'

import {
  find,
} from './util/dom'

import {
  isArray,
  isString,
  isObject,
  isFunction,
} from './util/is'

import {
  create,
  patch,
} from './dom/vdom'

// 四个内建指令，其他指令通过扩展实现
import lazy from './directive/lazy'
import event from './directive/event'
import model from './directive/model'
import component from './directive/component'

function bindFunctions(functions, thisArg) {
  let result = { }
  objectEach(functions, function (fn, name) {
    result[name] = fn.bind(thisArg)
  })
  return result
}

export default class Cola {

  /**
   * 全局指令
   *
   * @type {Object}
   */
  static directives = { lazy, event, model, component }

  /**
   * 全局过滤器
   *
   * @type {Object}
   */
  static filters = { }

  /**
   * 全局模板片段
   *
   * @type {Object}
   */
  static partials = { }

  /**
   * 配置项
   *
   * @constructor
   * @param {Object} options
   * @property {string|HTMLElement} options.el
   * @property {string} options.template
   * @property {Object|Function} options.data
   */
  constructor(options) {

    this.$components = objectExtend({}, options.components)
    this.$methods = objectExtend({}, options.methods)

    this.$data = isFunction(options.data) ? options.data.call(this) : options.data
    this.$directives = objectExtend({}, Cola.directives, options.directives)
    this.$filters = bindFunctions(objectExtend({}, Cola.filters, options.filters), this)
    this.$partials = objectExtend({}, Cola.partials, options.partials)

    // 把计算属性拆为 getter 和 setter
    let $computedGetters =
    this.$computedGetters = { }

    let $computedSetters =
    this.$computedSetters = { }

    // 存储计算属性的值，提升性能
    let $computedCache =
    this.$computedCache = { }

    // 辅助获取计算属性的依赖
    let $computedStack =
    this.$computedStack = [ ]
    // 计算属性的依赖关系
    // dep => [ computed1, computed2, ... ]
    let $computedWatchers =
    this.$computedWatchers = { }
    // computed => [ dep1, dep2, ... ]
    let $computedDeps =
    this.$computedDeps = { }

    if (isObject(options.computed)) {
      objectEach(
        options.computed,
        (item, keypath) => {
          let get, set, cache = true
          if (isFunction(item)) {
            get = item
          }
          else if (isObject(item)) {
            if (objectHas(item, 'cache')) {
              cache = item.cache
            }
            if (isFunction(item.get)) {
              get = item.get
            }
            if (isFunction(item.set)) {
              set = item.set
            }
          }

          if (get) {
            let getter = () => {

              if (cache && objectHas($computedCache, keypath)) {
                return $computedCache[keypath]
              }

              // 新推一个依赖收集数组
              $computedStack.push([])
              let result = get.call(this)

              // 处理收集好的依赖
              let newDeps = $computedStack.pop()
              let oldDeps = $computedDeps[keypath]
              $computedDeps[keypath] = newDeps

              // 增加了哪些依赖，删除了哪些依赖
              let addedDeps = []
              let removedDeps = []
              if (isArray(oldDeps)) {
                mergeArray(oldDeps, newDeps)
                .forEach(function (dep) {
                  let oldExisted = hasItem(oldDeps, dep)
                  let newExisted = hasItem(newDeps, dep)
                  if (oldExisted && !newExisted) {
                    removedDeps.push(dep)
                  }
                  else if (!oldExisted && newExisted) {
                    addedDeps.push(dep)
                  }
                })
              }
              else {
                addedDeps = newDeps
              }

              addedDeps.forEach(function (dep) {
                if (!isArray($computedWatchers[dep])) {
                  $computedWatchers[dep] = []
                }
                $computedWatchers[dep].push(keypath)
              })

              removedDeps.forEach(function (dep) {
                removeItem($computedWatchers[dep], keypath)
              })

              // 不论是否开启 computed cache，获取 oldValue 时还有用
              // 因此要存一下
              $computedCache[keypath] = result

              return result
            }
            // 当模板读取计算属性时，可通过 toString 求值
            // 省的写一堆乱七八糟的判断逻辑
            getter.toString = getter
            $computedGetters[keypath] = getter
          }

          if (set) {
            $computedSetters[keypath] = set.bind(this)
          }

        }
      )
    }

    // 监听各种事件
    this.$eventEmitter = new Emitter()

    objectEach(
      lifecycle,
      name => {
        let listener = options[`on${name}`]
        if (isFunction(listener)) {
          this.on(name, listener)
        }
      }
    )

    // 监听数据变化
    this.$watchEmitter = new Emitter()

    if (isObject(options.watchers)) {
      objectEach(
        options.watchers,
        (watcher, keypath) => {
          this.watch(keypath, watcher)
        }
      )
    }

    // 准备就绪
    this.fire(lifecycle.CREATE)

    // 编译模板
    this.$parser = new Mustache()
    this.$templateAst = this.$parser.parse(
      options.template,
      name => {
        let config = this.$components[name]
        if (!config) {
          throw new Error(`${name} component is not existed.`)
        }
        return function (el) {
          return new Cola({
            ...config,
            replace: true,
            el,
          })
        }
      },
      name => {
        let partial = this.$partials[name]
        if (!partial) {
          throw new Error(`${name} partial is not existed.`)
        }
        return partial
      },
      (name, node) => {
        this.$partials[name] = node
      }
    )

    this.fire(lifecycle.COMPILE)


    let el = isString(options.el) ? find(options.el) : options.el
    if (!el || el.nodeType !== 1) {
      throw new Error('el is not a element.')
    }

    // 触发 compile 事件之后再给 $el 赋值
    // 避免有些人在 oncompile 就误以为可以操作 el 了
    if (!options.replace) {
      el.innerHTML = '<div></div>'
      el = el.firstChild
    }

    this.updateView(el)

  }

  get(keypath) {

    // 计算属性的依赖追踪
    let { $data, $computedGetters, $computedStack } = this
    let deps = lastItem($computedStack)
    if (deps) {
      deps.push(keypath)
    }

    let getter = $computedGetters[keypath]
    if (isFunction(getter)) {
      return getter()
    }
    return objectGet($data, keypath)

  }

  set(keypath, value) {
    if (isString(keypath)) {
      keypath = {
        [keypath]: value,
      }
    }
    if (this.updateModel(keypath)) {
      this.updateView()
    }
  }

  on(type, listener) {
    this.$eventEmitter.on(type, listener)
  }

  once(type, listener) {
    this.$eventEmitter.once(type, listener)
  }

  off(type, listener) {
    this.$eventEmitter.off(type, listener)
  }

  fire(type, data) {
    this.$eventEmitter.fire(type, [data], this)
  }

  watch(keypath, watcher) {
    this.$watchEmitter.on(keypath, watcher)
  }

  watchOnce(keypath, watcher) {
    this.$watchEmitter.once(keypath, watcher)
  }

  toggle(keypath) {
    this.set(
      keypath,
      !this.get(keypath)
    )
  }

  updateModel(model) {

    let changes = { }

    let setter
    let oldValue

    let {
      $data,
      $watchEmitter,
      $computedCache,
      $computedWatchers,
      $computedSetters,
    } = this

    objectEach(model, (value, keypath) => {
      oldValue = this.get(keypath)
      if (value !== oldValue) {
        changes[keypath] = [ value, oldValue ]
        setter = $computedSetters[keypath]
        if (isFunction(setter)) {
          setter(value)
        }
        else {
          objectSet($data, keypath, value)
        }
        if (isArray($computedWatchers[keypath])) {
          $computedWatchers[keypath].forEach(function (watcher) {
            if (watcher in $computedCache) {
              delete $computedCache[watcher]
            }
          })
        }
      }
    })

    if (objectCount(changes)) {
      objectEach(
        changes,
        (args, keypath) => {
          getWildcardMatches(keypath).forEach(
            wildcardKeypath => {
              $watchEmitter.fire(
                wildcardKeypath,
                mergeArray(args, getWildcardNames(keypath, wildcardKeypath)),
                this
              )
            }
          )
        }
      )
      return true
    }

  }

  updateView(el) {

    let {
      $data,
      $filters,
      $parser,
      $templateAst,
      $currentNode,
      $computedGetters,
    } = this

    let context = {
      ...$data,
      ...$filters,
      ...$computedGetters,
      [syntax.SPECIAL_KEYPATH]: '',
    }

    let newNode = create(
      $parser.render($templateAst, context),
      this
    )

    if ($currentNode) {
      this.$currentNode = patch($currentNode, newNode)
      this.fire(lifecycle.UDPATE)
    }
    else {
      this.$currentNode = patch(el, newNode)
      this.$el = this.$currentNode.elm
      this.fire(lifecycle.ATTACH)
    }

  }

}
