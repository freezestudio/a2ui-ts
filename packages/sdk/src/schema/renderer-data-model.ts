/**
 * A2UI v1.0 Renderer Data Model 声明类型
 * 对应 JSON Schema: renderer_data_model.json
 *
 * 用于双向数据同步：Renderer 在启用 sendDataModel 的 surface 上，把当前
 * 全部活跃 surface 的 DataModel 通过 A2A 元数据（a2uiRendererDataModel）发送给 Agent。
 */

import { z } from 'zod';
import { SPEC_VERSION } from './constants.js';

/**
 * Renderer Data Model — 所有启用 sendDataModel 的 surface 的当前数据模型映射。
 * version 固定为 v1.0，surfaces 以 surfaceId 为键映射到各 surface 的数据模型。
 */
export const RendererDataModelSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  surfaces: z.record(z.string(), z.record(z.string(), z.unknown())),
});
export type RendererDataModel = z.infer<typeof RendererDataModelSchema>;

/** 判断是否为合法 Renderer Data Model 载荷 */
export function isRendererDataModel(value: unknown): value is RendererDataModel {
  return RendererDataModelSchema.safeParse(value).success;
}
