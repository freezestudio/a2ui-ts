/**
 * A2UI Eval 生成器
 * 负责调用 LLM 生成 A2UI 消息
 *
 * 架构：
 * - Generator 抽象基类 — 定义生成流程（已下沉到 @a2ui-ts/agent，此处 re-export）
 * - MockGenerator — 返回预定义 JSON，用于测试
 * - 实际的 LLM 生成器需继承 Generator 实现 callLLM 方法
 */

import { Generator } from '@a2ui-ts/agent';
import type { GeneratedResult, ModelConfig } from '@a2ui-ts/agent';

export { Generator } from '@a2ui-ts/agent';

// ============================================================================
// MockGenerator — 预定义 JSON，用于测试
// ============================================================================

const MOCK_RESPONSES: Record<string, string> = {
  loginForm: JSON.stringify(
    [
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'login-surface',
          catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'login-surface',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['title', 'username-field', 'password-field', 'remember-check', 'button-row'],
            },
            { id: 'title', component: 'Text', variant: 'h2', text: '用户登录' },
            { id: 'username-field', component: 'TextField', label: '用户名', placeholder: '请输入用户名' },
            {
              id: 'password-field',
              component: 'TextField',
              label: '密码',
              placeholder: '请输入密码',
              variant: 'password',
            },
            { id: 'remember-check', component: 'CheckBox', label: '记住我', checked: false },
            { id: 'button-row', component: 'Row', children: ['login-btn', 'register-btn'] },
            { id: 'login-btn', component: 'Button', label: '登录', variant: 'primary' },
            { id: 'register-btn', component: 'Button', label: '注册', variant: 'secondary' },
          ],
        },
      },
    ],
    null,
    2,
  ),

  dashboard: JSON.stringify(
    [
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'dashboard-surface',
          catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'dashboard-surface',
          components: [
            { id: 'root', component: 'Row', children: ['left-panel', 'right-panel'] },
            { id: 'left-panel', component: 'Column', children: ['overview-card'] },
            {
              id: 'overview-card',
              component: 'Card',
              children: ['overview-title', 'user-count', 'order-count', 'revenue'],
            },
            { id: 'overview-title', component: 'Text', variant: 'h3', text: '今日概览' },
            { id: 'user-count', component: 'Text', variant: 'body', text: '用户数: 1,234' },
            { id: 'order-count', component: 'Text', variant: 'body', text: '订单数: 567' },
            { id: 'revenue', component: 'Text', variant: 'body', text: '收入: ¥89,012' },
            { id: 'right-panel', component: 'Column', children: ['activity-card'] },
            { id: 'activity-card', component: 'Card', children: ['activity-title', 'activity-list'] },
            { id: 'activity-title', component: 'Text', variant: 'h3', text: '最近活动' },
            { id: 'activity-list', component: 'List', children: ['act-1', 'act-2', 'act-3'] },
            { id: 'act-1', component: 'Text', variant: 'body', text: '用户A完成下单' },
            { id: 'act-2', component: 'Text', variant: 'body', text: '用户B修改地址' },
            { id: 'act-3', component: 'Text', variant: 'body', text: '用户C提交退款' },
          ],
        },
      },
    ],
    null,
    2,
  ),

  deleteSurface: JSON.stringify(
    [
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'temp-surface',
          catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'temp-surface',
          components: [
            { id: 'root', component: 'Column', children: ['text-1', 'close-btn'] },
            { id: 'text-1', component: 'Text', variant: 'body', text: '临时页面' },
            { id: 'close-btn', component: 'Button', label: '关闭', variant: 'secondary' },
          ],
        },
      },
      {
        version: 'v1.0',
        deleteSurface: {
          surfaceId: 'temp-surface',
        },
      },
    ],
    null,
    2,
  ),
};

/** 默认 fallback 响应 — 最小合法消息 */
const DEFAULT_MOCK_RESPONSE = JSON.stringify(
  [
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'default-surface',
        catalogId: 'https://a2ui.org/specification/v1_0/catalogs/minimal/catalog.json',
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'default-surface',
        components: [
          { id: 'root', component: 'Column', children: ['text-1'] },
          { id: 'text-1', component: 'Text', variant: 'body', text: 'Mock 生成内容' },
        ],
      },
    },
  ],
  null,
  2,
);

export class MockGenerator extends Generator {
  protected async callLLM(_prompt: string, _modelConfig: ModelConfig): Promise<string> {
    // 模拟延迟
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
    return DEFAULT_MOCK_RESPONSE;
  }

  /** 执行生成，使用预定义响应 */
  override async run(): Promise<GeneratedResult[]> {
    const results: GeneratedResult[] = [];

    for (const model of this.models) {
      for (const prompt of this.prompts) {
        for (let run = 1; run <= this.runsPerPrompt; run++) {
          const startTime = performance.now();
          const rawText = MOCK_RESPONSES[prompt.name] ?? DEFAULT_MOCK_RESPONSE;
          const latency = performance.now() - startTime;

          const components = this.extractComponentsPublic(rawText);
          results.push({
            modelName: model.name,
            prompt,
            runNumber: run,
            rawText,
            components,
            latency,
          });
        }
      }
    }

    return results;
  }

  private extractComponentsPublic(rawText: string): unknown[] {
    try {
      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.debug('[MockGenerator] 组件解析失败:', err);
      return [];
    }
  }
}
