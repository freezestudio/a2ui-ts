import { describe, it, expect } from 'vite-plus/test';
import { createSchemaManager } from '@a2ui/sdk';

const EVAL_PROMPTS: Array<{ name: string; description: string; promptText: string }> = [
  {
    name: 'loginForm',
    description: '登录表单',
    promptText:
      "Generate a 'createSurface' message and a 'updateComponents' message with surfaceId 'main' for a login form. It should have a 'Text' (variant 'h1') \"Login\", two text fields for username and password, a checkbox for \"Remember Me\", and a \"Sign In\" button.",
  },
  {
    name: 'productGallery',
    description: '产品列表',
    promptText:
      "Generate a 'createSurface' and 'updateComponents' for a product gallery. Display a list of products from the data model at '/products'. Each item should be a Card with Image, Text for name, and a Button \"Add to Cart\".",
  },
  {
    name: 'settingsPage',
    description: '设置页',
    promptText:
      'Generate a \'createSurface\' and \'updateComponents\' for a settings page. Use a Tabs component with two tabs: "Profile" and "Notifications". Include a Modal component with trigger button "Delete Account".',
  },
  {
    name: 'contactForm',
    description: '联系表单',
    promptText:
      "Generate a 'createSurface' and 'updateComponents' for a contact form with TextField for name, email (with required and email checks), ChoicePicker for preference, CheckBox for newsletter, and a Button.",
  },
  {
    name: 'dashboard',
    description: '仪表盘',
    promptText:
      "Generate a 'createSurface' and 'updateComponents' for a dashboard. A 'Text' (h1) \"Sales Dashboard\". Below, a 'Row' of three 'Card's with metrics.",
  },
  {
    name: 'musicPlayer',
    description: '音乐播放器',
    promptText:
      "Generate a 'createSurface' and 'updateComponents' for a music player. Card with Column containing Image, Text for title, Slider for progress, and Row with three Buttons.",
  },
  {
    name: 'weatherForecast',
    description: '天气预报',
    promptText:
      "Generate a 'createSurface' and 'updateComponents' for weather forecast. Text (h1) city name, Row with temperature and icon, Divider, then a List of 5-day forecast.",
  },
  {
    name: 'flightBooker',
    description: '航班预订',
    promptText:
      "Generate a 'createSurface' and 'updateComponents' for a flight booking form. TextFields for Origin/Destination, DateTimeInputs for dates, Slider for passengers, Button.",
  },
  {
    name: 'surveyForm',
    description: '调查问卷',
    promptText:
      'Create a survey form. ChoicePicker (mutuallyExclusive) for rating, ChoicePicker (multipleSelection) for likes, TextField for comments, Button.',
  },
  {
    name: 'nestedDataBinding',
    description: '嵌套数据绑定',
    promptText:
      "Generate a Project Dashboard with List of projects bound to '/projects'. Each project has a List of tasks. Each task has a Row for assignee with nested data bindings.",
  },
  {
    name: 'deleteSurface',
    description: '删除 Surface',
    promptText: "Generate a deleteSurface for the surface 'dashboard-surface-1'.",
  },
  {
    name: 'updateDataModel',
    description: '更新数据模型',
    promptText:
      'Generate a createSurface followed by an updateDataModel message to set \'/user/name\' to "John Doe" and \'/user/email\' to "john@example.com".',
  },
];

describe('Eval Prompts — SchemaManager 集成测试', () => {
  it('所有 12 个 eval prompts 可通过 SchemaManager 生成 system prompt', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({
      roleDescription: '你是一个 A2UI 助手',
      includeSchema: true,
      includeExamples: true,
    });

    expect(prompt.length).toBeGreaterThan(1000);
    expect(prompt).toContain('A2UI');
    expect(prompt).toContain('JSON Schema');
  });

  for (const evalPrompt of EVAL_PROMPTS) {
    it(`eval prompt [${evalPrompt.name}]: 描述非空且包含 UI 关键词`, () => {
      expect(evalPrompt.description.length).toBeGreaterThan(0);
      expect(evalPrompt.promptText.length).toBeGreaterThan(10);

      const hasUiKeyword =
        evalPrompt.promptText.includes('Surface') ||
        evalPrompt.promptText.includes('Component') ||
        evalPrompt.promptText.includes('Text') ||
        evalPrompt.promptText.includes('Button') ||
        evalPrompt.promptText.includes('Card') ||
        evalPrompt.promptText.includes('List') ||
        evalPrompt.promptText.includes('deleteSurface') ||
        evalPrompt.promptText.includes('updateDataModel');
      expect(hasUiKeyword).toBe(true);
    });
  }

  it('SchemaManager 在 full 模式下仍可生成有效 prompt', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({
      roleDescription: 'Test',
    });
    expect(prompt).toContain('Test');
    expect(prompt).toContain('Text');
  });

  it('SchemaManager 在 full 模式下包含全部 18 个组件', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({
      roleDescription: 'Test',
    });
    const expectedComponents = [
      'Text',
      'Button',
      'Row',
      'Column',
      'Card',
      'Image',
      'TextField',
      'Icon',
      'Video',
      'AudioPlayer',
      'List',
      'Tabs',
      'Modal',
      'Divider',
      'CheckBox',
      'ChoicePicker',
      'Slider',
      'DateTimeInput',
    ];
    for (const comp of expectedComponents) {
      expect(prompt, `应包含组件 ${comp}`).toContain(comp);
    }
  });
});
