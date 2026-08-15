import { Type } from '@angular/core';
import { COMPONENT_SCHEMA_BY_TYPE } from '@a2ui/web-core';
import type { ComponentSchemaLike } from './catalog-registry.js';
import { A2UIText } from './basic/text.js';
import { A2UIButton } from './basic/button.js';
import { A2UIImage } from './basic/image.js';
import { A2UIColumn } from './basic/column.js';
import { A2UIRow } from './basic/row.js';
import { A2UICard } from './basic/card.js';
import { A2UITextField } from './basic/textfield.js';
import { A2UIDivider } from './basic/divider.js';
import { A2UISpacer } from './spacer.js';
import { A2UIIcon } from './basic/icon.js';
import { A2UIVideo } from './basic/video.js';
import { A2UIAudioPlayer } from './basic/audio-player.js';
import { A2UICheckBox } from './basic/check-box.js';
import { A2UISlider } from './basic/slider.js';
import { A2UIList } from './basic/list.js';
import { A2UITabs } from './basic/tabs.js';
import { A2UIModal } from './basic/modal.js';
import { A2UIChoicePicker } from './basic/choice-picker.js';
import { A2UIDateTimeInput } from './basic/date-time-input.js';

/**
 * Basic Catalog 组件注册表（18 个组件全量注册）
 *
 * 所有组件统一 descriptor 直读型（接受 component/surface inputs），
 * 由 a2ui-component 通过 NgComponentOutlet 动态实例化。
 *
 * placeholder 是增量渲染占位标记，不应映射为真实组件类。
 * 它由 a2ui-component 模板的 @case ('placeholder') 分支处理（占位脉冲块），
 * 若注册到 Catalog，会被 NgComponentOutlet 当真实组件实例化并强传
 * {component, surface} inputs，导致 NG0303/NG0950 运行时错误。
 */
export const COMPONENT_TYPE_MAP: Record<string, Type<unknown>> = {
  Text: A2UIText,
  Button: A2UIButton,
  Image: A2UIImage,
  Column: A2UIColumn,
  Row: A2UIRow,
  Card: A2UICard,
  TextField: A2UITextField,
  Divider: A2UIDivider,
  Spacer: A2UISpacer,
  Icon: A2UIIcon,
  Video: A2UIVideo,
  AudioPlayer: A2UIAudioPlayer,
  CheckBox: A2UICheckBox,
  Slider: A2UISlider,
  List: A2UIList,
  Tabs: A2UITabs,
  Modal: A2UIModal,
  ChoicePicker: A2UIChoicePicker,
  DateTimeInput: A2UIDateTimeInput,
};

export function getBasicComponentRegistrations(): {
  type: string;
  componentClass: Type<unknown>;
  schema?: ComponentSchemaLike;
}[] {
  return Object.entries(COMPONENT_TYPE_MAP).map(([type, componentClass]) => ({
    type,
    componentClass,
    schema: COMPONENT_SCHEMA_BY_TYPE[type],
  }));
}
