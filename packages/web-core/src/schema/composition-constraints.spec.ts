import { describe, expect, it, beforeEach } from 'vite-plus/test';
import {
  SURFACE_COMPONENT,
  UNALLOWED_CHILD,
  UNALLOWED_PARENT,
  registerCatalogConstraints,
  clearCatalogConstraints,
  getConstraintResolver,
  checkCompositionConstraints,
} from './composition-constraints.js';
import type { A2UIDescriptor } from '../state/surface-manager.js';

function comp(id: string, component: string, extra: Record<string, unknown> = {}): A2UIDescriptor {
  return { id, component, ...extra } as A2UIDescriptor;
}

describe('composition-constraints（allowedParents/allowedChildren，v1.0 #2155）', () => {
  beforeEach(() => clearCatalogConstraints());

  describe('约束注册表', () => {
    it('未注册 catalog 时解析器恒返回 undefined（缺省允许所有）', () => {
      const resolver = getConstraintResolver('https://example.com/custom.json');
      expect(resolver('Text')).toBeUndefined();
      expect(resolver('AnyThing')).toBeUndefined();
    });

    it('未传 catalogId 时不查表', () => {
      registerCatalogConstraints('cat-a', { Text: { allowedParents: ['Card'] } });
      const resolver = getConstraintResolver(undefined);
      expect(resolver('Text')).toBeUndefined();
    });

    it('注册后按组件类型解析约束；重复注册以最新为准', () => {
      registerCatalogConstraints('cat-a', { Text: { allowedParents: ['Card'] } });
      let resolver = getConstraintResolver('cat-a');
      expect(resolver('Text')).toEqual({ allowedParents: ['Card'] });
      expect(resolver('Image')).toBeUndefined();

      registerCatalogConstraints('cat-a', { Image: { allowedChildren: ['Text'] } });
      resolver = getConstraintResolver('cat-a');
      expect(resolver('Text')).toBeUndefined();
      expect(resolver('Image')).toEqual({ allowedChildren: ['Text'] });
    });

    it('clearCatalogConstraints 清空全部', () => {
      registerCatalogConstraints('cat-a', { Text: { allowedParents: ['Card'] } });
      clearCatalogConstraints();
      expect(getConstraintResolver('cat-a')('Text')).toBeUndefined();
    });
  });

  describe('checkCompositionConstraints', () => {
    it('无约束时不报错', () => {
      const issues = checkCompositionConstraints(
        [comp('root', 'Column', { children: ['t'] }), comp('t', 'Text')],
        () => undefined,
      );
      expect(issues).toEqual([]);
    });

    it('子组件 allowedParents 不含父类型 → UNALLOWED_PARENT（path 为子 ID）', () => {
      const issues = checkCompositionConstraints(
        [comp('card', 'Card', { child: 'img' }), comp('img', 'Image')],
        (type) => (type === 'Image' ? { allowedParents: ['Row', 'Column'] } : undefined),
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe(UNALLOWED_PARENT);
      expect(issues[0].path).toBe('img');
      expect(issues[0].message).toContain('Card');
    });

    it('父容器 allowedChildren 不含子类型 → UNALLOWED_CHILD（path 为父 ID）', () => {
      const issues = checkCompositionConstraints(
        [comp('row', 'Row', { children: ['btn'] }), comp('btn', 'Button', { child: 'lbl' }), comp('lbl', 'Text')],
        (type) => (type === 'Row' ? { allowedChildren: ['Text', 'Image'] } : undefined),
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe(UNALLOWED_CHILD);
      expect(issues[0].path).toBe('row');
      expect(issues[0].message).toContain('Button');
    });

    it('child 单引用与 object 模板模式均参与校验', () => {
      // object 模板：children = { componentId, path }，模板组件声明 allowedParents
      const issues = checkCompositionConstraints(
        [
          comp('list', 'List', { children: { componentId: 'tpl', path: '/items' } }),
          comp('tpl', 'TextField', { label: 'x' }),
        ],
        (type) => (type === 'TextField' ? { allowedParents: ['Column'] } : undefined),
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe(UNALLOWED_PARENT);
      expect(issues[0].path).toBe('tpl');
    });

    it('root 组件 allowedParents 不含 Surface → UNALLOWED_PARENT', () => {
      const issues = checkCompositionConstraints(
        [comp('root', 'Modal', { trigger: 'btn', content: 'body' }), comp('btn', 'Button'), comp('body', 'Text')],
        (type) => (type === 'Modal' ? { allowedParents: ['Card'] } : undefined),
      );
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe(UNALLOWED_PARENT);
      expect(issues[0].path).toBe('root');
      expect(issues[0].message).toContain(SURFACE_COMPONENT);
    });

    it('root 组件 allowedParents 含 Surface → 通过', () => {
      const issues = checkCompositionConstraints([comp('root', 'Custom')], (type) =>
        type === 'Custom' ? { allowedParents: [SURFACE_COMPONENT] } : undefined,
      );
      expect(issues).toEqual([]);
    });

    it('悬空子引用不产生组合错误（由完整性检查负责）', () => {
      const issues = checkCompositionConstraints([comp('col', 'Column', { children: ['ghost'] })], (type) =>
        type === 'Text' ? { allowedParents: [] } : undefined,
      );
      expect(issues).toEqual([]);
    });
  });
});
