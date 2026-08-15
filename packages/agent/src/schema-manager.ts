/**
 * A2UI SchemaManager 共享实例
 *
 * 独立成模块，避免生成器与包入口（index.ts）之间的循环 import。
 */
import { createSchemaManager } from '@freezestudio/a2ui-sdk';

export const sharedSchemaManager = createSchemaManager();
