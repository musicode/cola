
import {
  IF,
} from '../nodeType'

/**
 * if 节点
 *
 * @param {string} cond 判断条件
 * @param {Array} nodes 如果条件为真，需要渲染的节点列表
 */
export default class If(cond, nodes) {
  this.type = IF
  this.cond = cond
  this.nodes = nodes
}