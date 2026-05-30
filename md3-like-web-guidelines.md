# MD3-like UI Guidelines for Web

本项目当前是 Web 项目，UI 风格参考 Material Design 3，但不直接依赖 Material Web 或其他官方 MD3 组件库。

项目应通过自有组件、样式 tokens 和 CSS 实现 MD3-like 外观。规范重点面向 Web，但组件 API、token 命名和样式结构应保持技术栈中立，避免强绑定特定框架、UI 库或平台能力，以降低未来迁移到其他端的成本。

## 1. 基本原则

- 不引入 Material Web 或其他官方 MD3 组件库作为 UI 依赖。
- 不复制官方组件库的 DOM 结构、Shadow DOM 机制、样式穿透机制或技术绑定 API。
- 允许使用 MD3 的设计语义名称，例如 filled、outlined、text、tonal、elevated，但这些名称应作为项目自有组件的语义约定，而不是对官方组件库 API 的依赖。
- 使用项目自有组件实现 MD3-like 外观。
- 视觉样式必须通过 design tokens 管理。
- 禁止在业务组件中随意硬编码颜色、字号、圆角、阴影。
- 组件结构应简单、语义清晰、易迁移。
- 样式实现应尽量避免绑定特定框架能力。
- 所有交互组件必须考虑 default、pressed、focus、disabled、selected、error、loading 等核心状态；hover 仅在支持指针悬停的 Web 场景中实现。

## 2. 技术约束

UI 组件必须由项目自有组件实现。

复杂、可复用或具有统一视觉规范的 UI，不应在业务代码中重复手写，应优先沉淀为项目统一组件，例如：

- Button
- TextField
- Card
- Dialog
- Tabs
- Switch
- Checkbox
- Select
- NavigationBar
- NavigationRail
- Menu
- ListItem

组件 API 应保持语义化和技术栈中立。

以下字段名称是语义示例，具体命名应遵循当前项目约定。

Button:

- variant: filled | outlined | text | tonal | elevated
- size: small | medium | large
- disabled
- loading
- icon
- fullWidth

TextField:

- label
- value
- placeholder
- helperText
- error
- errorText
- disabled
- required

Dialog:

- open
- title
- description
- actions
- closeOnBackdrop
- keyboardDismiss

禁止在业务代码中直接写一次性复杂 UI：

```html
<button class="custom-purple-button">提交</button>
<input class="random-input-style" />
```

应使用项目统一组件或统一 class 体系表达 UI 意图。

## 3. Design Tokens

Design tokens 是跨端抽象，不等同于 CSS variables 本身。

Web 端默认使用 CSS variables 实现 tokens；未来迁移到其他端时，应将 tokens 映射为平台等价的主题变量、样式常量或配置对象。

推荐 token 类型：

```css
:root {
  /* Color */
  --app-color-primary: #6750a4;
  --app-color-on-primary: #ffffff;
  --app-color-secondary: #625b71;
  --app-color-on-secondary: #ffffff;

  --app-color-surface: #fffbfe;
  --app-color-on-surface: #1c1b1f;
  --app-color-surface-container: #f3edf7;
  --app-color-outline: #79747e;

  --app-color-error: #ba1a1a;
  --app-color-on-error: #ffffff;

  /* State colors */
  --app-color-primary-hover: rgba(103, 80, 164, 0.08);
  --app-color-primary-pressed: rgba(103, 80, 164, 0.12);
  --app-color-surface-hover: rgba(28, 27, 31, 0.08);
  --app-color-surface-pressed: rgba(28, 27, 31, 0.12);

  /* Typography */
  --app-font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --app-font-size-body: 14px;
  --app-font-size-label: 14px;
  --app-font-size-title: 16px;
  --app-font-size-headline: 24px;

  --app-line-height-body: 20px;
  --app-line-height-title: 24px;
  --app-line-height-headline: 32px;

  /* Shape */
  --app-radius-small: 4px;
  --app-radius-medium: 8px;
  --app-radius-large: 16px;
  --app-radius-extra-large: 28px;
  --app-radius-full: 999px;

  /* Spacing */
  --app-space-1: 4px;
  --app-space-2: 8px;
  --app-space-3: 12px;
  --app-space-4: 16px;
  --app-space-6: 24px;
  --app-space-8: 32px;

  /* State */
  --app-state-hover-opacity: 0.08;
  --app-state-focus-opacity: 0.12;
  --app-state-pressed-opacity: 0.12;
  --app-state-disabled-opacity: 0.38;

  /* Elevation */
  --app-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.16);
  --app-elevation-2: 0 2px 6px rgba(0, 0, 0, 0.18);
  --app-elevation-3: 0 4px 12px rgba(0, 0, 0, 0.2);
}
```

业务样式应使用 token：

```css
.card {
  background: var(--app-color-surface);
  color: var(--app-color-on-surface);
  border-radius: var(--app-radius-large);
  box-shadow: var(--app-elevation-1);
}
```

禁止：

```css
.card {
  background: #ffffff;
  color: #222222;
  border-radius: 13px;
  box-shadow: 0 3px 9px #ccc;
}
```

## 4. 色彩规范

- 使用语义化颜色 token。
- 文本颜色应优先使用对应的 `on-*` token。
- 不得只通过颜色表达状态。
- 错误、警告、成功状态必须同时包含文本、图标或提示。
- 亮色 / 暗色主题都应通过 token 切换。

Web 端示例：

```css
:root {
  color-scheme: light;

  --app-color-primary: #6750a4;
  --app-color-on-primary: #ffffff;
  --app-color-surface: #fffbfe;
  --app-color-on-surface: #1c1b1f;
}

[data-theme="dark"] {
  color-scheme: dark;

  --app-color-primary: #d0bcff;
  --app-color-on-primary: #381e72;
  --app-color-surface: #141218;
  --app-color-on-surface: #e6e0e9;
}
```

## 5. 排版规范

- 使用统一字体族。
- 使用语义化字号 token。
- 不允许在业务样式中随意写孤立字号。
- 页面标题、区块标题、正文、辅助文本、按钮文本应使用不同层级。

Web 端示例：

```css
.text-body {
  font-family: var(--app-font-family);
  font-size: var(--app-font-size-body);
  line-height: var(--app-line-height-body);
}

.text-title {
  font-family: var(--app-font-family);
  font-size: var(--app-font-size-title);
  line-height: var(--app-line-height-title);
  font-weight: 500;
}
```

## 6. Shape 与间距

- 圆角使用 token。
- 间距使用 4px / 8px 倍数体系。
- 不允许出现无依据的 `7px`、`13px`、`19px` 等魔法值。
- 卡片、弹窗、菜单、输入框、按钮应保持统一圆角体系。

Web 端示例：

```css
.button {
  border-radius: var(--app-radius-full);
  padding: 0 var(--app-space-6);
}

.card {
  border-radius: var(--app-radius-large);
  padding: var(--app-space-4);
}

.dialog {
  border-radius: var(--app-radius-extra-large);
}
```

## 7. 组件状态

所有可交互组件至少考虑：

- default
- pressed
- focus
- disabled
- selected，如适用
- error，如适用
- loading，如适用
- hover，仅在支持指针悬停的 Web 场景中适用

Web 端可以使用 `:hover`、`:focus-visible`、`:active` 等伪类实现状态反馈；但组件状态本身必须抽象为通用状态，不得只依赖 Web-only 伪类。

状态颜色、透明度、边框、阴影等应优先通过 token 提供，避免在业务样式中直接计算颜色。

Web 端示例：

```css
.app-button:hover {
  background-color: var(--app-color-primary-hover);
}

.app-button:active {
  background-color: var(--app-color-primary-pressed);
}

.app-button:focus-visible {
  outline: 2px solid var(--app-color-primary);
  outline-offset: 2px;
}

.app-button:disabled {
  opacity: var(--app-state-disabled-opacity);
  cursor: not-allowed;
}
```

禁止无替代地移除焦点样式：

```css
/* forbidden */
button:focus {
  outline: none;
}

/* allowed */
button:focus-visible {
  outline: 2px solid var(--app-color-primary);
  outline-offset: 2px;
}
```

## 8. 状态反馈实现原则

状态反馈优先通过以下方式表达：

- 状态层
- 背景色
- 透明度
- 边框
- 阴影
- 文本提示
- 图标提示

动画、滤镜、缩放等效果必须可降级，不应作为理解状态的唯一方式。

不推荐把核心状态只绑定到以下实现：

```css
filter: brightness(0.96);
transform: scale(0.98);
```

这些效果可以作为增强体验，但不能作为唯一反馈。

## 9. 按钮规范

按钮至少支持以下变体：

- filled
- outlined
- text
- tonal
- elevated

Web 端示例：

```css
.app-button {
  min-height: 40px;
  padding: 0 var(--app-space-6);
  border-radius: var(--app-radius-full);
  border: none;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.app-button--filled {
  background: var(--app-color-primary);
  color: var(--app-color-on-primary);
}

.app-button--outlined {
  background: transparent;
  color: var(--app-color-primary);
  border: 1px solid var(--app-color-outline);
}

.app-button--text {
  background: transparent;
  color: var(--app-color-primary);
}
```

图标按钮必须提供无障碍名称。

Web 端示例：

```html
<button class="app-icon-button" aria-label="关闭">
  <span aria-hidden="true">×</span>
</button>
```

## 10. 表单规范

表单组件必须具备：

- label
- value
- placeholder，如需要
- helperText，如需要
- errorText，如需要
- disabled 状态
- required 语义
- focus 状态

错误状态不得只改变边框颜色，必须显示错误文本。

Web 端示例：

```html
<label class="app-field">
  <span class="app-field__label">邮箱</span>
  <input class="app-field__input" required />
  <span class="app-field__error">请输入有效邮箱</span>
</label>
```

## 11. 卡片与容器

卡片用于承载一组相关内容。

Web 端示例：

```css
.app-card {
  background: var(--app-color-surface);
  color: var(--app-color-on-surface);
  border-radius: var(--app-radius-large);
  padding: var(--app-space-4);
  box-shadow: var(--app-elevation-1);
}
```

容器层级应通过 surface、surface-container、outline、elevation 区分，不要滥用强阴影。

## 12. Web 无障碍要求

- 按钮、链接、输入框必须使用正确语义。
- 图标按钮必须提供 `aria-label` 或等价无障碍名称。
- 表单控件必须有 label。
- 错误信息必须是可见文本。
- 弹窗打开后焦点应进入弹窗，关闭后焦点应回到触发元素。
- 菜单、弹窗、Tabs、导航必须支持键盘操作。
- Web 端触控目标建议不小于 `48px × 48px`。
- 迁移到其他端时，应换算为平台推荐的等价触控尺寸。
- 不得只依赖颜色传达信息。

## 13. 响应式布局

Web 页面应根据屏幕宽度调整布局：

- 小屏：单列布局、底部导航优先。
- 中屏：可使用侧边导航或双列布局。
- 大屏：可使用侧边栏、多列内容区、内容最大宽度限制。

布局代码不得只适配单一屏幕尺寸。

## 14. 跨端迁移友好要求

为了降低未来迁移成本：

- 不要把视觉规范绑定到某个 UI 库。
- 不要在业务代码中直接使用第三方组件库 API。
- 不要复制 Material Web 的 DOM 结构、Shadow DOM 或 `::part()` 机制。
- 组件能力应保持语义化，例如 `variant`、`size`、`disabled`、`loading`、`error`。
- token 命名应保持平台无关。
- Web 端可以使用 CSS variables，但不要把 CSS variables 当作唯一 token 形态。
- 避免复杂 CSS 选择器、深层嵌套、难迁移的 hack。
- 避免依赖 Web-only 的视觉实现作为核心体验。
- 动画和交互效果应可关闭或可降级。

## 15. 代码评审 Checklist

提交 UI 代码前检查：

- 是否符合 MD3-like 风格？
- 是否没有依赖 Material Web 或其他官方 MD3 组件库？
- 是否使用项目自有组件？
- 是否避免复制官方组件库 DOM、Shadow DOM 或技术绑定 API？
- 是否避免硬编码颜色、字号、圆角、阴影？
- 是否通过 token 管理主题？
- 是否支持亮色 / 暗色主题？
- 是否覆盖 pressed、focus、disabled 等核心状态？
- 在支持指针悬停的 Web 场景中，是否提供 hover 状态？
- 表单是否具备 label、错误提示和 required 语义？
- 图标按钮是否有无障碍名称？
- 弹窗、菜单、导航是否支持键盘操作？
- 是否避免魔法值和一次性样式？
- 是否考虑未来迁移到其他端的成本？

## 16. 禁止项

禁止硬编码视觉值：

```css
background: #6750a4;
color: red;
font-size: 17px;
border-radius: 13px;
```

禁止无替代地移除焦点样式：

```css
button:focus {
  outline: none;
}
```

推荐使用 token：

```css
background: var(--app-color-primary);
color: var(--app-color-error);
font-size: var(--app-font-size-body);
border-radius: var(--app-radius-large);
```

禁止引入官方 MD3 组件库：

```ts
import "@material/web/button/filled-button.js";
```

禁止依赖官方组件内部机制：

```css
md-filled-button::part(button) {
  border-radius: 999px;
}
```

推荐使用项目自有组件和样式体系。

## 17. Agent 执行要求

在生成、修改或审查本项目 Web UI 代码时，agent 必须：

- 默认遵循本规范。
- 不引入 Material Web 或其他官方 MD3 组件库作为 UI 依赖。
- 使用项目自有组件实现 MD3-like 外观。
- 不复制官方组件库 DOM、Shadow DOM、`::part()` 或技术绑定 API。
- 可以使用 MD3 设计语义名称，但不得依赖官方组件库实现。
- 不生成硬编码视觉值，除非是在 token 定义文件中。
- 主动补全基础无障碍属性。
- 修改 UI 时同步考虑 light / dark theme。
- 优先生成跨框架、跨端迁移成本低的结构和样式。
- 将 Web-only 能力作为实现细节，而不是组件抽象本身。
- 对不符合规范的现有代码，应优先重构为 token 化、组件化实现。

## AGENTS.md 引用示例

```md
## UI Guidelines

Import and follow:

- `docs/md3-like-web-guidelines.md`

All generated Web UI code must follow the MD3-like UI Guidelines for Web.

Do not introduce Material Web or other official MD3 component libraries.
Use project-owned components and design tokens to imitate the MD3 visual style.
Keep component APIs and styling structure migration-friendly.
```
