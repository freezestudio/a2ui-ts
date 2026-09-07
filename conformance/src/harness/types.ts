export interface TestCaseBase {
  name: string;
  description: string;
}

export interface CatalogConfig {
  version: string;
  s2c_schema?: string;
  catalog_schema?: Record<string, unknown> | string;
  common_types_schema?: string;
}

export interface SDKBehaviorTestCase extends TestCaseBase {
  catalog: CatalogConfig;
  action:
    | 'process_chunk'
    | 'validate'
    | 'prune'
    | 'render'
    | 'load'
    | 'parse_full'
    | 'fix_payload'
    | 'has_parts'
    | 'select_catalog'
    | 'load_catalog'
    | 'generate_prompt'
    | 'data_model'
    | 'process_messages'
    | 'catalog_schema';
  steps?: DataModelStep[];
  initial?: Record<string, unknown>;
  watch?: string[];
  catalogPaths?: string[];
  messages?: unknown[] | { messages: unknown[] };
  payload?: unknown;
  args?: Record<string, unknown>;
  input?: string;
  expect?: unknown;
  expect_error?: ExpectedError;
  expect_selected?: string;
  expect_empty?: boolean;
  expect_contains?: string[];
  expect_output?: string;
  expect_catalog_schema?: Record<string, unknown>;
}

export interface ProcessChunkStep {
  input: string;
  expect: unknown;
}

export interface ExpectedError {
  category: ErrorCategory;
  message: string;
}

export type ErrorCategory =
  | 'ParseError'
  | 'ValidationError'
  | 'CatalogError'
  | 'IntegrityError'
  | 'RecursionError'
  | 'CompileError'
  | 'DataError';

export interface DataModelStep {
  op: 'get' | 'set' | 'delete' | 'dispose';
  path: string;
  value?: unknown;
  expect?: unknown;
  expect_absent?: boolean;
  expect_type?: 'list' | 'object';
  expect_values?: Record<string, unknown>;
  expect_notified?: string[];
  expect_error?: ExpectedError;
}

export interface SchemaValidationTestFile {
  schema: string;
  tests: SchemaValidationTestCase[];
}

export interface SchemaValidationTestCase {
  description: string;
  valid: boolean;
  data: Record<string, unknown>;
}

export interface V1ProtocolTestCase extends TestCaseBase {
  schema?: string;
  data: Record<string, unknown>;
  valid: boolean;
  expect_error?: string;
}

export interface A2AIntegrationTestCase extends TestCaseBase {
  action: string;
  args?: Record<string, unknown>;
  expect?: unknown;
  expect_empty?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
}
