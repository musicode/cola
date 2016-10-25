
import Mustache from '../../../src/compiler/parser/Mustache'

let html = `
<div class="{{#if hidden}}hidden{{/if}}">
  <h1>{{title}}</h1>
  <div>{{{body}}}</div>
  {{#if foo}}
    <div>foo</div>
  {{/if}}
  {{#partial listView}}
    <div>list</div>
  {{/partial}}
  {{> listView }}
</div>
{{#partial sayhi}}
    haha
{{/partial}}
`

html = `
<div class="{{#if hidden}}xxx{{/if}} 1">
  <h1>{{title}}</h1>
</div>
`

// html = `
// <div class="{{#if hidden}}aaa{{else if xxx}}bb {{name}} bb {{{ age }} {{else}}a cccc d{{/if}}">
//     {{#if list.length > 0}}
//         {{#each list:i}}
//             hi, {{name}}-{{i}}
//         {{/each}}
//     {{/if}}
//     <span{{#if xxx}} id="abc" value="22" {{/if}}></span>
//     <span value="{{#each classes}}{{.}} {{/each}}"></span>
// </div>
// `


describe('compiler/parser/Mustache', function () {
  it('Mustache', function () {
    let parser = new Mustache()
    console.time('parse')
    let ast = parser.parse(html)
    let vd = parser.build(ast, { hidden: false, title: '123' })

    console.timeEnd('parse')

    console.log(JSON.stringify(vd, null, 4))
  })
})
