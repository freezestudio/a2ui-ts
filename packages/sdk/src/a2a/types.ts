/**
 * A2A 协议类型定义
 * A2A v1.0 Part 类型
 */

import { z } from 'zod';

/** A2A Text Part */
export const a2aTextPartSchema = z.object({
  content: z.object({
    $case: z.literal('text'),
    value: z.string(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  mediaType: z.string().optional(),
  filename: z.string().optional(),
});
export type A2ATextPart = z.infer<typeof a2aTextPartSchema>;

/** A2A Data Part（承载 A2UI JSON） */
export const a2aDataPartSchema = z.object({
  content: z.object({
    $case: z.literal('data'),
    value: z.unknown(),
  }),
  metadata: z.object({
    mimeType: z.literal('application/a2ui+json'),
  }),
  mediaType: z.literal('application/a2ui+json').optional(),
  filename: z.string().optional(),
});
export type A2ADataPart = z.infer<typeof a2aDataPartSchema>;

/** A2A Raw Part */
export const a2aRawPartSchema = z.object({
  content: z.object({
    $case: z.literal('raw'),
    value: z.instanceof(Buffer),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  mediaType: z.string().optional(),
  filename: z.string().optional(),
});
export type A2ARawPart = z.infer<typeof a2aRawPartSchema>;

/** A2A URL Part */
export const a2aUrlPartSchema = z.object({
  content: z.object({
    $case: z.literal('url'),
    value: z.string(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  mediaType: z.string().optional(),
  filename: z.string().optional(),
});
export type A2AUrlPart = z.infer<typeof a2aUrlPartSchema>;

export const a2aPartSchema = z.union([a2aTextPartSchema, a2aDataPartSchema, a2aRawPartSchema, a2aUrlPartSchema]);
export type A2APart = z.infer<typeof a2aPartSchema>;

/** A2A Task 状态 */
export const a2aTaskStateSchema = z.enum([
  'UNSPECIFIED',
  'SUBMITTED',
  'WORKING',
  'INPUT_REQUIRED',
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'REJECTED',
  'AUTH_REQUIRED',
]);
export type A2ATaskState = z.infer<typeof a2aTaskStateSchema>;

/** A2A Task 状态 */
export const a2aTaskStatusSchema = z.object({
  state: a2aTaskStateSchema,
  message: z
    .object({
      role: z.number(),
      parts: z.array(a2aPartSchema),
    })
    .optional(),
});
export type A2ATaskStatus = z.infer<typeof a2aTaskStatusSchema>;

/** A2A 任务 */
export const a2aTaskSchema = z.object({
  id: z.string(),
  contextId: z.string(),
  status: a2aTaskStatusSchema,
  artifacts: z
    .array(
      z.object({
        parts: z.array(a2aPartSchema),
      }),
    )
    .optional(),
});
export type A2ATask = z.infer<typeof a2aTaskSchema>;
