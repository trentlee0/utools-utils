import { Action, ListItem, ListRenderFunction, TemplateExports } from './type'

interface Template {
  code: string
}

/**
 * 无 UI 模板
 */
export interface NoneTemplate extends Template {
  /**
   * 进入插件时调用
   */
  enter: (action: Action) => void
}

interface ListTemplate extends Template {
  /**
   * 输入框占位符
   *
   * 默认值为 `"搜索"`
   */
  placeholder?: string

  /**
   * 输入框改变时调用。
   *
   * 默认值为使用 `searchWord`，忽略大小写搜索字段 `title` 和 `description`。参见 {@link search} 方法
   */
  search?(action: Action, searchWord: string, render: ListRenderFunction): void
}

export interface ImmutableListItem extends ListItem {
  /**
   * 选中当前项的处理函数
   */
  handler: (action: Action) => void
}

/**
 * 不可变列表模板，列表项是固定的
 */
export interface ImmutableListTemplate extends ListTemplate {
  list: Array<ImmutableListItem>
}

/**
 * 可变列表模板，列表项是动态的
 */
export interface MutableListTemplate extends ListTemplate {
  /**
   * 用于获取动态列表数据，默认搜索中使用到，在 `enter` 中调用 `render` 函数会刷新。在实现类中定义后可直接使用，也可以忽略
   */
  $list?: Array<ListItem>

  /**
   * 进入插件时调用
   */
  enter(action: Action, render: ListRenderFunction): void

  /**
   * 使用回车键选择某项时调用
   */
  select(action: Action, item: ListItem): void
}

/**
 * 关键词搜索，忽略大小写搜索 `title` 和 `description`
 */

export function searchList(list: Array<ListItem>, word: string): ListItem[]
/**
 * 多关键词搜索，忽略大小写搜索 `title` 和 `description`
 */
export function searchList(list: Array<ListItem>, words: string[]): ListItem[]

export function searchList(list: Array<ListItem>, words: string | string[]) {
  if (!Array.isArray(words)) return search(list, words)

  let filteredList: Array<ListItem> = list
  for (const word of words) {
    filteredList = search(filteredList, word)
  }
  return filteredList
}

function search(list: Array<ListItem>, word: string) {
  if (!word) return list
  word = word.toLowerCase()
  return list.filter(({ title, description }) => {
    return (
      title.toLowerCase().includes(word) ||
      description?.toLowerCase().includes(word)
    )
  })
}

class TemplateBuilder {
  private readonly exports: TemplateExports = {}

  /**
   * 根据无 UI 模板构建
   * @param templates 无 UI 模板
   */
  none(...templates: Array<NoneTemplate>) {
    for (const template of templates) {
      this.exports[template.code] = {
        mode: 'none',
        args: {
          enter: (action) => template.enter(action)
        }
      }
    }
    return this
  }

  /**
   * 根据不可变列表模板构建
   * @param templates 不可变列表模板，列表项是固定的
   */
  immutableList(...templates: Array<ImmutableListTemplate>) {
    for (const template of templates) {
      const { list, placeholder } = template
      this.exports[template.code] = {
        mode: 'list',
        args: {
          enter: (action, render) => render(list),
          search: (action, searchWord, render) => {
            if (template.search) {
              template.search(action, searchWord, render)
            } else {
              render(search(list, searchWord))
            }
          },
          select: (action, item: ImmutableListItem) => item.handler(action),
          placeholder
        }
      }
    }
    return this
  }

  /**
   * 根据可变列表模板构建
   * @param templates 可变列表模板，列表项是动态的
   */
  mutableList(...templates: Array<MutableListTemplate>) {
    for (const template of templates) {
      const { placeholder } = template
      this.exports[template.code] = {
        mode: 'list',
        args: {
          enter: (action, render) => {
            template.enter(action, (list) => {
              template.$list = list
              render(list)
            })
          },
          search: (action, searchWord, render) => {
            if (template.search) {
              template.search(action, searchWord, render)
            } else {
              render(search(template.$list ?? [], searchWord))
            }
          },
          select: (action, item) => template.select(action, item),
          placeholder
        }
      }
    }
    return this
  }

  /**
   * 获取构建结果
   */
  build() {
    return this.exports
  }
}

/**
 * 模板构建器
 */
export function templateBuilder() {
  return new TemplateBuilder()
}
