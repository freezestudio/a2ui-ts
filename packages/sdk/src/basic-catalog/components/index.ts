import type { ComponentApi } from '../../catalog/types.js';
import { TextComponentSchema as _Text } from './text.js';
import { ButtonComponentSchema as _Button } from './button.js';
import { RowComponentSchema as _Row } from './row.js';
import { ColumnComponentSchema as _Column } from './column.js';
import { CardComponentSchema as _Card } from './card.js';
import { ImageComponentSchema as _Image } from './image.js';
import { TextFieldComponentSchema as _TextField } from './text-field.js';
import { IconComponentSchema as _Icon } from './icon.js';
import { VideoComponentSchema as _Video } from './video.js';
import { AudioPlayerComponentSchema as _AudioPlayer } from './audio-player.js';
import { ListComponentSchema as _List } from './list.js';
import { TabsComponentSchema as _Tabs } from './tabs.js';
import { ModalComponentSchema as _Modal } from './modal.js';
import { DividerComponentSchema as _Divider } from './divider.js';
import { CheckBoxComponentSchema as _CheckBox } from './check-box.js';
import { ChoicePickerComponentSchema as _ChoicePicker } from './choice-picker.js';
import { SliderComponentSchema as _Slider } from './slider.js';
import { DateTimeInputComponentSchema as _DateTimeInput } from './date-time-input.js';

export { TextComponentSchema } from './text.js';
export { ButtonComponentSchema } from './button.js';
export { RowComponentSchema } from './row.js';
export { ColumnComponentSchema } from './column.js';
export { CardComponentSchema } from './card.js';
export { ImageComponentSchema } from './image.js';
export { TextFieldComponentSchema } from './text-field.js';
export { IconComponentSchema } from './icon.js';
export { VideoComponentSchema } from './video.js';
export { AudioPlayerComponentSchema } from './audio-player.js';
export { ListComponentSchema } from './list.js';
export { TabsComponentSchema } from './tabs.js';
export { ModalComponentSchema } from './modal.js';
export { DividerComponentSchema } from './divider.js';
export { CheckBoxComponentSchema } from './check-box.js';
export { ChoicePickerComponentSchema } from './choice-picker.js';
export { SliderComponentSchema } from './slider.js';
export { DateTimeInputComponentSchema } from './date-time-input.js';

export const FULL_COMPONENTS: ComponentApi[] = [
  _Text,
  _Image,
  _Icon,
  _Video,
  _AudioPlayer,
  _Row,
  _Column,
  _List,
  _Card,
  _Tabs,
  _Modal,
  _Divider,
  _Button,
  _TextField,
  _CheckBox,
  _ChoicePicker,
  _Slider,
  _DateTimeInput,
];
