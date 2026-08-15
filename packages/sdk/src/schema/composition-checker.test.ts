import { describe, it, expect } from 'vite-plus/test';
import {
  SURFACE_COMPONENT,
  UNALLOWED_PARENT,
  UNALLOWED_CHILD,
  checkCompositionConstraints,
  extractParentChildPairs,
  type CompositionConstraints,
} from './composition-checker.js';

const NO_CONSTRAINTS = (): CompositionConstraints | undefined => undefined;

describe('extractParentChildPairs', () => {
  it('提取 children 数组引用', () => {
    const pairs = extractParentChildPairs([
      { id: 'root', component: 'Column', children: ['a', 'b'] },
      { id: 'a', component: 'Text' },
      { id: 'b', component: 'Button' },
    ]);
    expect(pairs).toEqual([
      { parentId: 'root', parentType: 'Column', childId: 'a', childType: 'Text' },
      { parentId: 'root', parentType: 'Column', childId: 'b', childType: 'Button' },
    ]);
  });

  it('提取 child 单引用', () => {
    const pairs = extractParentChildPairs([
      { id: 'root', component: 'Card', child: 'label' },
      { id: 'label', component: 'Text' },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ parentId: 'root', parentType: 'Card', childId: 'label', childType: 'Text' });
  });

  it('提取 object 模板模式（ChildList object）', () => {
    const pairs = extractParentChildPairs([
      { id: 'root', component: 'List', children: { path: '/items', componentId: 'item' } },
      { id: 'item', component: 'Card' },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].childId).toBe('item');
  });

  it('跳过悬空引用（由完整性检查负责）', () => {
    const pairs = extractParentChildPairs([{ id: 'root', component: 'Column', children: ['missing'] }]);
    expect(pairs).toHaveLength(0);
  });
});

describe('checkCompositionConstraints', () => {
  it('未声明约束时全部允许', () => {
    const errors = checkCompositionConstraints(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        { id: 'btn', component: 'Button' },
      ],
      NO_CONSTRAINTS,
    );
    expect(errors).toEqual([]);
  });

  it('allowedParents 违反时返回 UNALLOWED_PARENT', () => {
    const resolve = (type: string): CompositionConstraints | undefined =>
      type === 'Button' ? { allowedParents: ['Form'] } : undefined;
    const errors = checkCompositionConstraints(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        { id: 'btn', component: 'Button' },
      ],
      resolve,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('btn');
    expect(errors[0].message).toContain(UNALLOWED_PARENT);
  });

  it('allowedChildren 违反时返回 UNALLOWED_CHILD', () => {
    const resolve = (type: string): CompositionConstraints | undefined =>
      type === 'Row' ? { allowedChildren: ['Text'] } : undefined;
    const errors = checkCompositionConstraints(
      [
        { id: 'root', component: 'Row', children: ['btn'] },
        { id: 'btn', component: 'Button' },
      ],
      resolve,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('root');
    expect(errors[0].message).toContain(UNALLOWED_CHILD);
  });

  it('父/子同时违反时返回两条错误', () => {
    const resolve = (type: string): CompositionConstraints | undefined => {
      if (type === 'Row') return { allowedChildren: ['Text'] };
      if (type === 'Button') return { allowedParents: ['Form'] };
      return undefined;
    };
    const errors = checkCompositionConstraints(
      [
        { id: 'root', component: 'Row', children: ['btn'] },
        { id: 'btn', component: 'Button' },
      ],
      resolve,
    );
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.message.includes(UNALLOWED_PARENT))).toBe(true);
    expect(errors.some((e) => e.message.includes(UNALLOWED_CHILD))).toBe(true);
  });

  it('root 组件父类型视为 Surface：allowedParents 不含 Surface 时报错', () => {
    const resolve = (type: string): CompositionConstraints | undefined =>
      type === 'AppLayout' ? { allowedParents: ['CanvasContainer'] } : undefined;
    const errors = checkCompositionConstraints([{ id: 'root', component: 'AppLayout' }], resolve);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('root');
    expect(errors[0].message).toContain(UNALLOWED_PARENT);
    expect(errors[0].message).toContain(SURFACE_COMPONENT);
  });

  it('root 组件 allowedParents 含 Surface 时通过', () => {
    const resolve = (type: string): CompositionConstraints | undefined =>
      type === 'AppLayout' ? { allowedParents: [SURFACE_COMPONENT] } : undefined;
    const errors = checkCompositionConstraints([{ id: 'root', component: 'AppLayout' }], resolve);
    expect(errors).toEqual([]);
  });

  it('非 root 组件的 Surface 声明不误伤：allowedParents 不含 Surface 但父为普通容器时通过', () => {
    const resolve = (type: string): CompositionConstraints | undefined =>
      type === 'Card' ? { allowedParents: ['Column'] } : undefined;
    const errors = checkCompositionConstraints(
      [
        { id: 'root', component: 'Column', children: ['card'] },
        { id: 'card', component: 'Card' },
      ],
      resolve,
    );
    expect(errors).toEqual([]);
  });
});
