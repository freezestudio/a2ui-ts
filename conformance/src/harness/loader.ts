import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import * as yaml from 'js-yaml';

export function loadTestData<T = unknown>(filePath: string): T {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`无法读取测试数据文件: ${filePath}: ${String(err)}`);
  }

  const ext = extname(filePath).toLowerCase();

  try {
    if (ext === '.json') {
      return JSON.parse(content) as T;
    } else if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content) as T;
    } else {
      throw new Error(`不支持的文件格式: ${ext}（仅支持 .json、.yaml、.yml）`);
    }
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof yaml.YAMLException) {
      throw new Error(`解析测试数据文件失败: ${filePath}: ${err.message}`);
    }
    throw err;
  }
}
