/**
 * 表达式解析器 — Scanner + Parser
 * 对应 Python: basic_catalog/expression_parser.py
 *
 * 解析 ${...} 插值表达式，输出 DynamicValue 结构：
 * - 路径: {path: "user/name"}
 * - 函数调用: {call: "func", args: {...}, returnType: "any"}
 * - 字面量: 字符串/数字/布尔值
 */
import { z } from 'zod';

// ============================================================================
// Scanner — 字符流扫描器
// ============================================================================

class Scanner {
  input: string;
  pos: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  peek(offset = 0): string {
    const idx = this.pos + offset;
    if (idx >= this.input.length) return '\0';
    return this.input[idx];
  }

  advance(count = 1): string {
    const chars = this.input.slice(this.pos, this.pos + count);
    this.pos += count;
    return chars;
  }

  match(expected: string): boolean {
    if (this.peek() === expected) {
      this.advance();
      return true;
    }
    return false;
  }

  matches(expected: string): boolean {
    return this.input.startsWith(expected, this.pos);
  }

  matchesString(expected: string): boolean {
    return this.peek() === expected;
  }

  matchesKeyword(keyword: string): boolean {
    if (this.input.startsWith(keyword, this.pos)) {
      const nextChar = this.peek(keyword.length);
      if (!/[a-zA-Z0-9_]/.test(nextChar)) {
        this.advance(keyword.length);
        return true;
      }
    }
    return false;
  }

  skipWhitespace(): void {
    while (!this.isAtEnd() && /\s/.test(this.peek())) {
      this.advance();
    }
  }
}

// ============================================================================
// ExpressionParser — 递归下降解析器
// ============================================================================

/**
 * 解析结果类型
 */
export const parseResultSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({ path: z.string() }),
  z.object({ call: z.string(), args: z.record(z.string(), z.unknown()), returnType: z.string() }),
]);

export type ParseResult = z.infer<typeof parseResultSchema>;

/**
 * ExpressionParser — 解析 ${...} 插值模板表达式
 *
 * 输入: "Hello ${user/name}, you have ${count} items"
 * 输出: ["Hello ", {path: "user/name"}, ", you have ", {path: "count"}, " items"]
 *
 * 输入: "${formatString(template: 'Hello', name: user/name)}"
 * 输出: [{call: "formatString", args: {template: "Hello", name: {path: "user/name"}}, returnType: "any"}]
 */
export class ExpressionParser {
  static readonly MAX_DEPTH = 10;

  /**
   * 解析模板字符串，返回交替的字面量和动态值片段
   */
  parse(input: string, depth = 0): ParseResult[] {
    if (depth > ExpressionParser.MAX_DEPTH) {
      throw new Error('Max recursion depth reached in parse');
    }

    if (!input || !input.includes('${')) {
      return input ? [input] : [];
    }

    const parts: ParseResult[] = [];
    const scanner = new Scanner(input);

    while (!scanner.isAtEnd()) {
      if (scanner.matches('${')) {
        scanner.advance(2);
        const content = this.extractInterpolationContent(scanner);
        const parsed = this.parseExpression(content, depth + 1);
        if (parsed !== null && parsed !== '') {
          parts.push(parsed as ParseResult);
        }
      } else if (scanner.peek() === '\\' && scanner.peek(1) === '$' && scanner.peek(2) === '{') {
        // 转义的 \${ → 字面量 ${
        scanner.advance();
        parts.push('${');
        scanner.advance(2);
      } else {
        // 普通文本
        const start = scanner.pos;
        while (!scanner.isAtEnd()) {
          if (scanner.matches('${')) break;
          if (scanner.peek() === '\\' && scanner.peek(1) === '$' && scanner.peek(2) === '{') {
            break;
          }
          scanner.advance();
        }
        const text = scanner.input.slice(start, scanner.pos);
        if (text) {
          parts.push(text);
        }
      }
    }

    return parts.filter((p) => p !== null && p !== '');
  }

  /**
   * 提取 ${...} 内部的内容（处理嵌套花括号和字符串引号）
   */
  extractInterpolationContent(scanner: Scanner): string {
    const start = scanner.pos;
    let braceBalance = 1;

    while (!scanner.isAtEnd() && braceBalance > 0) {
      const char = scanner.advance();
      if (char === '{') {
        braceBalance++;
      } else if (char === '}') {
        braceBalance--;
      } else if (char === "'" || char === '"') {
        // 跳过字符串字面量
        const quote = char;
        while (!scanner.isAtEnd()) {
          const c = scanner.advance();
          if (c === '\\') {
            scanner.advance(); // 跳过转义字符
          } else if (c === quote) {
            break;
          }
        }
      }
    }

    if (braceBalance > 0) {
      throw new Error("Unclosed interpolation: missing '}'");
    }

    return scanner.input.slice(start, scanner.pos - 1);
  }

  /**
   * 解析表达式（单个表达式 → DynamicValue）
   */
  parseExpression(expr: string, depth = 0): ParseResult | string {
    if (depth > ExpressionParser.MAX_DEPTH) {
      throw new Error('Max recursion depth reached in parse');
    }

    expr = expr.trim();
    if (!expr) return '';

    const scanner = new Scanner(expr);
    const result = this.parseExpressionInternal(scanner, depth);

    if (!scanner.isAtEnd()) {
      throw new Error(`Unexpected characters at end of expression: '${scanner.input.slice(scanner.pos)}'`);
    }

    return result;
  }

  /**
   * 内部递归解析
   */
  parseExpressionInternal(scanner: Scanner, depth: number): ParseResult | string {
    scanner.skipWhitespace();
    if (scanner.isAtEnd()) return '';

    // 0. 嵌套插值 ${...}
    if (scanner.matches('${')) {
      scanner.advance(2);
      const content = this.extractInterpolationContent(scanner);
      return this.parseExpression(content, depth + 1) as ParseResult;
    }

    // 1. 字面量
    if (scanner.matchesString("'") || scanner.matchesString('"')) {
      return this.parseStringLiteral(scanner);
    }

    if (this.isDigit(scanner.peek()) || (scanner.peek() === '-' && this.isDigit(scanner.peek(1)))) {
      return this.parseNumberLiteral(scanner);
    }

    if (scanner.matchesKeyword('true')) return true;
    if (scanner.matchesKeyword('false')) return false;
    if (scanner.matchesKeyword('null')) return '';

    // 2. 标识符（函数调用或路径）
    const token = this.scanPathOrIdentifier(scanner);
    scanner.skipWhitespace();

    if (scanner.peek() === '(') {
      return this.parseFunctionCall(token, scanner, depth);
    } else {
      if (!token) return '';
      return { path: token };
    }
  }

  /** 扫描路径或标识符 */
  scanPathOrIdentifier(scanner: Scanner): string {
    const start = scanner.pos;
    while (!scanner.isAtEnd()) {
      const c = scanner.peek();
      // '@' 支持系统标识符（如模板内 ${@index(offset:1)}）
      if (this.isAlnum(c) || '/._-@'.includes(c)) {
        scanner.advance();
      } else {
        break;
      }
    }
    return scanner.input.slice(start, scanner.pos);
  }

  /** 解析函数调用 */
  parseFunctionCall(
    funcName: string,
    scanner: Scanner,
    depth: number,
  ): { call: string; args: Record<string, unknown>; returnType: string } {
    scanner.match('(');
    scanner.skipWhitespace();

    const args: Record<string, unknown> = {};

    while (!scanner.isAtEnd() && scanner.peek() !== ')') {
      const argName = this.scanIdentifier(scanner);
      scanner.skipWhitespace();

      if (!scanner.match(':')) {
        throw new Error(`Expected ':' after argument name '${argName}' in function '${funcName}'`);
      }

      scanner.skipWhitespace();
      args[argName] = this.parseExpressionInternal(scanner, depth);

      scanner.skipWhitespace();
      if (scanner.peek() === ',') {
        scanner.advance();
        scanner.skipWhitespace();
      }
    }

    if (!scanner.match(')')) {
      throw new Error(`Expected ')' after function arguments for '${funcName}'`);
    }

    return { call: funcName, args, returnType: 'any' };
  }

  /** 扫描标识符 */
  scanIdentifier(scanner: Scanner): string {
    const start = scanner.pos;
    while (!scanner.isAtEnd() && (this.isAlnum(scanner.peek()) || scanner.peek() === '_')) {
      scanner.advance();
    }
    return scanner.input.slice(start, scanner.pos);
  }

  /** 解析字符串字面量 */
  parseStringLiteral(scanner: Scanner): string {
    const quote = scanner.advance();
    let result = '';

    while (!scanner.isAtEnd()) {
      const c = scanner.advance();
      if (c === '\\') {
        const nextC = scanner.advance();
        switch (nextC) {
          case 'n':
            result += '\n';
            break;
          case 't':
            result += '\t';
            break;
          case 'r':
            result += '\r';
            break;
          default:
            result += nextC;
            break;
        }
      } else if (c === quote) {
        break;
      } else {
        result += c;
      }
    }

    return result;
  }

  /** 解析数字字面量 */
  parseNumberLiteral(scanner: Scanner): number {
    const start = scanner.pos;
    if (scanner.peek() === '-') scanner.advance();

    while (!scanner.isAtEnd() && (this.isDigit(scanner.peek()) || scanner.peek() === '.')) {
      scanner.advance();
    }

    const numStr = scanner.input.slice(start, scanner.pos);
    return numStr.includes('.') ? parseFloat(numStr) : parseInt(numStr, 10);
  }

  /** 是否为字母数字 */
  private isAlnum(c: string): boolean {
    return /[a-zA-Z0-9]/.test(c);
  }

  /** 是否为数字 */
  private isDigit(c: string): boolean {
    return /[0-9]/.test(c);
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/** 解析模板字符串中的插值表达式 */
export function parseTemplateExpression(input: string): ParseResult[] {
  const parser = new ExpressionParser();
  return parser.parse(input);
}
