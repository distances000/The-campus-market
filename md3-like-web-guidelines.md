# MD3 风格 Web 项目开发规范

本文档用于约束本项目的 Material Design 3（MD3）风格实现方式。目标不是“看起来像 Google”，而是让设计令牌、组件语义、页面结构、交互状态和可访问性都保持一致，避免页面各自为政。

本规范以 Material 官方文档为依据，主要参考：

- `material-web.dev` 的 theming 和 component 文档，作为 Web 落地的直接规范
- `m3.material.io` 的 color、typography、shape、motion、component 思路，作为视觉和交互方向参考

说明：

- `m3.material.io` 的很多页面依赖 JavaScript 渲染，本文中的可执行规则主要依据 `material-web.dev` 的 token 和组件文档整理
- 与 motion、页面布局相关的部分，属于基于 MD3 思想做出的项目实现约定，文中会明确标注为“项目约定”

## 1. 适用范围

本规范适用于：

- Web 端页面样式
- Web 端自研组件
- 第三方组件库的主题覆盖
- 设计令牌命名和主题组织
- 页面级布局、导航、表单、列表、卡片、对话框、反馈状态

本规范不要求必须引入 `@material/web`。如果项目使用 Vue、React、Element Plus、Naive UI 或自研组件，仍然必须遵守 MD3 的语义层规则。

## 2. 总体原则

### 2.1 先系统，后页面

先定义主题系统，再做页面。

开发顺序固定为：

1. 主题令牌
2. 基础组件
3. 复合组件
4. 页面结构
5. 动效和边界状态

禁止先在页面里写死颜色、圆角、阴影、边框，再回头“提取主题”。

### 2.2 先语义，后视觉

任何视觉值都应先映射到语义角色，再被组件消费。

例如：

- 不直接写“蓝色按钮”
- 要写“primary action”
- 不直接写“浅灰卡片背景”
- 要写“surface-container”

### 2.3 组件外观必须由 token 驱动

以下值不得直接散落在业务页面里：

- 颜色
- 字号
- 行高
- 字重
- 圆角
- 阴影
- 间距体系
- 焦点环
- 状态透明度

允许在业务页中使用 token，不允许业务页自己定义另一套视觉规则。

### 2.4 优先使用 MD3 的层级关系

页面视觉优先通过以下方式建立层次：

- surface 分层
- typography 对比
- shape 区分
- state layer
- elevation

不要依赖重边框、大面积高饱和色块、过度渐变来制造层次。

## 3. 主题架构

## 3.1 令牌分层

主题令牌分为三层：

1. `ref` 层：品牌原始值，如色板、字体族、字重
2. `sys` 层：MD3 语义系统值，如 color roles、typescale、shape roles
3. `comp` 层：组件级映射值，如 button、chip、dialog、tab 的具体 token

Web 端推荐结构：

```css
:root {
    /* reference */
    --md-ref-typeface-brand: "Roboto";
    --md-ref-typeface-plain: "Roboto";

    /* system */
    --md-sys-color-primary: #415f91;
    --md-sys-color-on-primary: #ffffff;
    --md-sys-shape-corner-medium: 12px;
    --md-sys-typescale-body-medium-size: 0.875rem;

    /* component */
    --app-button-filled-bg: var(--md-sys-color-primary);
    --app-button-filled-fg: var(--md-sys-color-on-primary);
}
```

规则：

- `ref` 层只放原始值
- `sys` 层只放语义值
- 组件样式不得绕过 `sys` 层直接引用品牌原始值，除非是品牌识别区

## 3.2 命名规则

优先使用 MD3 风格命名：

- color: `--md-sys-color-*`
- typescale: `--md-sys-typescale-*`
- shape: `--md-sys-shape-*`

如果项目已有自定义前缀，必须保持一一映射，例如：

```css
:root {
    --app-color-primary: var(--md-sys-color-primary);
    --app-color-surface: var(--md-sys-color-surface);
}
```

禁止混用三套名字且无映射关系。

## 3.3 明暗主题

必须支持 light theme。是否支持 dark theme 由产品决定，但主题结构必须允许后续扩展。

要求：

- light 和 dark 共用一套 token 语义
- 不允许 dark theme 单独手写另一套“页面颜色”
- 主题切换只改 token，不改组件结构

## 4. 颜色规范

依据 Material Web color 文档，颜色应以 role 而非单色值管理。

### 4.1 必备 color roles

至少定义以下系统角色：

- `primary`
- `on-primary`
- `primary-container`
- `on-primary-container`
- `secondary`
- `on-secondary`
- `secondary-container`
- `tertiary`
- `error`
- `on-error`
- `background`
- `surface`
- `surface-dim`
- `surface-bright`
- `surface-container-lowest`
- `surface-container-low`
- `surface-container`
- `surface-container-high`
- `surface-container-highest`
- `on-surface`
- `on-surface-variant`
- `outline`
- `outline-variant`

### 4.2 使用规则

- 页面背景优先使用 `background` 或 `surface`
- 卡片、表单块、浮层优先使用 `surface-container-*`
- 主操作使用 `primary`
- 次级强调使用 `secondary` 或 `tertiary`
- 错误状态只使用 `error` 体系
- 文本颜色优先使用 `on-*` 或 `on-surface*`

禁止：

- 业务页自己写“成功绿、警告黄、危险红”的随机色值
- 一个页面里同时出现多个不相关的主强调色
- 用透明度叠色替代语义色角色

### 4.3 色彩生成

推荐使用以下方式生成主题：

1. Material Theme Builder
2. `material-color-utilities`

项目约定：

- 品牌色先生成完整 scheme，再选用 role
- 不允许手工凭感觉补出 container 和 on-color

## 5. 字体与排版规范

依据 Material Web typography 文档。

### 5.1 默认字体

如果没有明确替换字体，默认使用 `Roboto`。

中文项目建议：

- 英文与数字：`Roboto`
- 中文：`Noto Sans SC` 或平台等价无衬线字体

建议：

```css
:root {
    --md-ref-typeface-brand: "Roboto", "Noto Sans SC", sans-serif;
    --md-ref-typeface-plain: "Roboto", "Noto Sans SC", sans-serif;
}
```

### 5.2 typescale 角色

至少覆盖以下层级：

- display
- headline
- title
- body
- label

每层应保留 `small`、`medium`、`large` 语义，不要求每页都全部用到。

### 5.3 页面使用规则

- 页面主标题：`headline` 或 `display`
- 区块标题：`title`
- 正文和说明：`body`
- 按钮、标签、表单短文本：`label`

禁止：

- 仅靠 `font-size` 随意拼排版
- 同一页面出现大量 1px 级别的字号微调
- 使用 `12, 13, 15, 16, 17, 18` 等无体系字号而没有映射说明

## 6. 形状规范

依据 Material Web shape 文档。

### 6.1 shape roles

必须定义：

- `corner-none`
- `corner-extra-small`
- `corner-small`
- `corner-medium`
- `corner-large`
- `corner-extra-large`
- `corner-full`

### 6.2 使用约定

推荐映射：

- text field、chip、small card：`small` 或 `medium`
- card、dialog、bottom sheet：`large` 或 `extra-large`
- avatar、badge、pill button：`full`

规则：

- 同一组件族必须使用固定 shape 语义
- 不允许同类卡片在不同页面随意换圆角

## 7. Elevation 与 Surface 规范

MD3 的层次不应主要依赖重阴影，而应依赖 surface 分层。

### 7.1 优先级

层次构建优先级：

1. surface role
2. outline / outline-variant
3. shape
4. elevation

### 7.2 项目约定

建议只保留少量 elevation 层级：

- `level-0`：无浮起，页面基底
- `level-1`：普通卡片、列表项
- `level-2`：浮起操作区、置顶条
- `level-3`：dialog、menu、popover

禁止：

- 每个组件一套不同阴影
- 阴影颜色和 blur 半径无规则增长

## 8. 交互状态规范

Material Web 组件文档明确存在 hover、focus、pressed 等状态 token；项目必须为所有交互组件定义完整状态。

### 8.1 必备状态

所有交互组件都必须考虑：

- default
- hover
- focus
- pressed
- disabled

按需支持：

- selected
- error
- loading
- dragged

### 8.2 状态实现规则

- `hover` 只在支持悬停的设备生效
- `focus` 必须有清晰可见的焦点环，不能只依赖颜色轻微变化
- `pressed` 应体现状态层或轻微位移，而不是只改透明度
- `disabled` 应保留语义可识别性，必要时允许 soft-disabled 场景

### 8.3 焦点规范

项目必须统一焦点环：

- 颜色优先使用 `primary`
- 焦点环与组件边界要有足够对比
- 不允许去掉 outline 却不给替代样式

## 9. 可访问性规范

依据 Material Web button、icon-button、checkbox、dialog 等文档整理。

### 9.1 标签与可读名称

- 没有可见文本的按钮必须提供 `aria-label`
- toggle icon button 必须提供选中前后不同的可访问名称
- checkbox、switch、radio 必须显式提供可访问标签

### 9.2 键盘可达性

- 所有可操作控件必须可通过键盘访问
- dialog 默认保持 focus trap，除非有明确可访问性理由
- menu、tabs、navigation 等组件必须支持键盘导航

### 9.3 禁用态

默认 disabled 控件不可交互；只有明确需要提升可发现性时才使用 soft-disabled 模式。

### 9.4 触控目标

项目约定：

- 主要交互目标最小可点击区按 `48 x 48px` 设计
- 图标按钮、小型选择控件如果视觉尺寸较小，外层仍需补足触控区域

## 10. 组件规范

## 10.1 Button

必须支持以下语义 variant：

- filled
- tonal
- outlined
- text
- elevated

使用规则：

- filled：页面主操作
- tonal：次一级强调操作
- outlined：弱强调、可逆操作
- text：低优先级操作
- elevated：需要从背景中轻微抬起，但不应替代 filled 主操作

禁止：

- 一个操作区同时出现多个 filled 主按钮
- 删除类危险操作默认用 filled primary

## 10.2 Text Field

优先实现 filled text field 风格；如果有明确表格化或高信息密度场景，可补充 outlined。

必须支持：

- label
- value
- placeholder
- helper text
- error
- disabled
- readonly
- prefix / suffix

规则：

- 表单错误优先通过 error color、supporting text 和控件状态共同表达
- 不允许只在 toast 里报错，而输入框本身没有状态变化

## 10.3 Card

card 不是单纯白底盒子，必须属于某个 surface 层级。

至少区分：

- informational card
- actionable card
- selected card

actionable card 必须具备 hover、focus、pressed 状态。

## 10.4 Chips

至少支持：

- filter chip
- suggestion chip
- input chip

使用规则：

- 分类筛选、状态筛选优先用 filter chip
- 轻量推荐动作可用 suggestion chip
- 已选实体或标签输入可用 input chip

## 10.5 Tabs

tabs 用于同级内容切换，不用于流程步骤。

要求：

- 选中态必须有 active indicator
- 文本长度差异大时，优先保证可读性，不强制等宽
- 移动端允许横向滚动，但要保证当前项可见

## 10.6 Dialog

dialog 用于中断式确认或短流程输入，不用于完整页面。

要求：

- 标题、正文、操作区结构明确
- 默认启用 focus trap
- 危险操作必须有明确文案，不允许只有“确定”

## 10.7 FAB

FAB 只用于页面最重要、最主要、最高频的单个动作。

规则：

- 一个页面通常只应有一个 FAB
- 如果页面已有明确主按钮区，不再额外放 FAB
- FAB 不应用来承载次要动作

## 10.8 Navigation

底部导航、侧边导航、顶部导航只能选其一作为当前页面主导航结构，不要在同一层级重复表达。

推荐：

- 移动端一级导航：navigation bar
- 平板 / 宽屏：navigation rail 或 drawer

## 10.9 List

列表项必须具备清晰的信息优先级：

- 主文本
- 次文本
- leading visual
- trailing action / metadata

不要让列表项同时承担过多操作。若操作过多，应转为详情页或菜单。

## 11. 页面结构规范

### 11.1 页面层级

页面推荐拆成：

1. app bar / page header
2. hero 或 summary 区
3. primary content
4. secondary content
5. persistent action 区

### 11.2 间距体系

项目约定采用 4px 基线栅格，优先使用以下间距：

- `4`
- `8`
- `12`
- `16`
- `20`
- `24`
- `32`
- `40`

禁止：

- 为对齐某个元素随意写 `7px`、`13px`、`19px`
- 页面内部同时出现多种无规律间距

### 11.3 信息密度

MD3 风格不等于“所有地方都很松”。需要根据场景控制密度：

- 首页、个人中心、详情页：可适度宽松
- 列表、消息、订单：中等密度
- 表单和设置页：保证输入效率，避免过度留白

## 12. 动效规范

说明：Material Web 当前不提供 motion system token；以下为基于 MD3 思路制定的项目约定。

### 12.1 原则

- 动效服务于状态变化，不服务于炫技
- 优先强调层级切换、焦点转移、内容展开收起
- 动效不得拖慢主路径操作

### 12.2 项目约定

推荐时长：

- hover / pressed：`120ms` 到 `180ms`
- focus / selection：`150ms` 到 `200ms`
- panel / dialog / sheet：`200ms` 到 `300ms`

推荐属性：

- `opacity`
- `transform`
- `box-shadow`
- `background-color`

避免：

- 大范围 blur 动画
- 频繁的高度自动过渡
- 关键操作后长时间等待动画结束

## 13. 第三方组件库适配规范

如果项目继续使用 Element Plus 或其他组件库，必须通过主题覆盖接近 MD3，而不是默认皮肤和自定义页面样式混用。

要求：

- 统一覆写按钮、输入框、对话框、标签、菜单、表格的圆角和颜色体系
- 第三方控件的默认蓝、默认灰、默认阴影必须被替换
- 组件库 token 应映射到本项目的 `md-sys` 或 `app` token

禁止：

- 页面自己补一层样式覆盖，组件库本身还是另一套视觉
- 同一页面里自研控件是 MD3，第三方控件是另一种风格

## 14. 代码组织规范

推荐目录：

```text
client/src/
    theme/
        tokens.css
        light.css
        dark.css
        components.css
    components/
        base/
        composite/
    views/
```

推荐拆分：

- `tokens.css`：reference 和 system tokens
- `components.css`：按钮、输入框、标签、导航等统一覆盖
- 页面只写局部布局，不重写全局视觉规则

## 15. 评审清单

提交前至少检查以下问题：

- 是否存在硬编码颜色、圆角、阴影、字号
- 是否所有主交互都有 hover、focus、pressed、disabled
- 是否页面层级主要通过 surface 和 typography 建立
- 是否按钮层级清晰，主操作只有一个视觉中心
- 是否文本字段具备 label、error、helper text
- 是否图标按钮、checkbox、switch 具备可访问名称
- 是否移动端点击目标足够大
- 是否第三方组件已经纳入统一主题
- 是否页面仍然存在“看起来像 MD3，但 token 命名和语义完全不对”的情况

## 16. 项目落地要求

从现在开始，新增或重构页面必须满足：

1. 先补 token，再写页面
2. 先补基础组件状态，再接业务
3. 先做 light theme 统一，再考虑 dark theme
4. 不再允许页面级零散视觉修补长期存在

对现有项目的改造顺序建议：

1. 全局 color / typescale / shape token 收口
2. Button、TextField、Dialog、Card、Chip、Tabs 统一
3. Navigation 和 page container 统一
4. Home、Profile、Detail、Messages 逐页改造
5. 最后补动效和暗色主题

## 17. 官方参考

- Material Web Theming: [https://material-web.dev/theming/material-theming/](https://material-web.dev/theming/material-theming/)
- Material Web Color: [https://material-web.dev/theming/color/](https://material-web.dev/theming/color/)
- Material Web Typography: [https://material-web.dev/theming/typography/](https://material-web.dev/theming/typography/)
- Material Web Shape: [https://material-web.dev/theming/shape/](https://material-web.dev/theming/shape/)
- Material Web Buttons: [https://material-web.dev/components/button/](https://material-web.dev/components/button/)
- Material Web Text Field: [https://material-web.dev/components/text-field/](https://material-web.dev/components/text-field/)
- Material Web Chips: [https://material-web.dev/components/chip/](https://material-web.dev/components/chip/)
- Material Web Tabs: [https://material-web.dev/components/tabs/](https://material-web.dev/components/tabs/)
- Material Web Dialog: [https://material-web.dev/components/dialog/](https://material-web.dev/components/dialog/)
- Material Web FAB: [https://material-web.dev/components/fab/](https://material-web.dev/components/fab/)
- Material Web Lists: [https://material-web.dev/components/list/](https://material-web.dev/components/list/)
- Material Design 3: [https://m3.material.io/](https://m3.material.io/)
