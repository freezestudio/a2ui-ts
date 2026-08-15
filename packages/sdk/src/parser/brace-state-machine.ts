/**
 * 括号栈状态机 — 逐字符追踪 JSON 嵌套结构和字符串状态
 */

import type { BraceStackEntry } from './types.js';

export class BraceStateMachine {
  readonly braceStack: BraceStackEntry[] = [];
  inString = false;
  private stringEscaped = false;
  private rawBuffer = '';
  private charIndex = 0;
  private topLevelListDetected = false;

  processChar(char: string): void {
    this.rawBuffer += char;

    if (this.inString) {
      if (this.stringEscaped) {
        this.stringEscaped = false;
      } else if (char === '\\') {
        this.stringEscaped = true;
      } else if (char === '"') {
        this.inString = false;
      }
      this.charIndex++;
      return;
    }

    switch (char) {
      case '"':
        this.inString = true;
        break;
      case '{':
        this.braceStack.push({ type: '{', startPos: this.charIndex });
        break;
      case '[':
        this.braceStack.push({ type: '[', startPos: this.charIndex });
        if (this.braceStack.length === 1) {
          this.topLevelListDetected = true;
        }
        break;
      case '}':
      case ']':
        this.braceStack.pop();
        if (this.braceStack.length === 0) {
          this.topLevelListDetected = false;
        }
        break;
    }

    this.charIndex++;
  }

  get depth(): number {
    return this.braceStack.length;
  }

  get isTopLevelList(): boolean {
    return this.topLevelListDetected;
  }

  extractFragment(startPos: number): string {
    return this.rawBuffer.slice(startPos);
  }

  get buffer(): string {
    return this.rawBuffer;
  }

  getCurrentOpenBrackets(): Array<'{' | '['> {
    return this.braceStack.map((e) => e.type);
  }

  reset(): void {
    this.braceStack.length = 0;
    this.inString = false;
    this.stringEscaped = false;
    this.rawBuffer = '';
    this.charIndex = 0;
    this.topLevelListDetected = false;
  }
}
