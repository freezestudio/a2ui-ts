/**
 * A2UI 组件属性约束 — 单一声明源
 * 同时被 catalog 定义和 validator 引用，避免硬编码重复
 *
 * 每个条目：组件名 → { 属性名 → 允许的值列表 }
 * 共有的属性: {id: '', accessibility: {label: '', description: ''}}
 */
export const COMPONENT_CONSTRAINTS: Record<string, Record<string, readonly string[]>> = {
  Text: {
    variant: ['caption', 'body'],
  },
  Button: {
    variant: ['default', 'primary', 'borderless'],
  },
  TextField: {
    variant: ['longText', 'number', 'shortText', 'obscured'],
  },
  ChoicePicker: {
    displayStyle: ['checkbox', 'chips'],
    variant: ['multipleSelection', 'mutuallyExclusive'],
  },
  Slider: {},
  Row: {
    justify: ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch'],
    align: ['start', 'center', 'end', 'stretch'],
  },
  Column: {
    justify: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
    align: ['center', 'end', 'start', 'stretch'],
  },
  Image: {
    fit: ['contain', 'cover', 'fill', 'none', 'scaleDown'],
    variant: ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'],
  },
  List: {
    direction: ['vertical', 'horizontal'],
    align: ['start', 'center', 'end', 'stretch'],
  },
  Divider: {
    axis: ['horizontal', 'vertical'],
  },
  Tabs: {},
  Modal: {},
  Icon: {},
  Video: {},
  AudioPlayer: {},
  Card: {},
  CheckBox: {},
  DateTimeInput: {},
};
