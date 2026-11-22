import type { StaticDecode, TObject, TSchema } from 'typebox';

/**
 * Options for configuring the TypeBox validator behavior.
 */
export interface ValidatorTypeboxOptions {
  /**
   * When `true`, enables parsing and transformation of validated values.
   * Parsed values will be assigned back to the request object (except query which is readonly).
   * Can be overridden per-route using `validatorTypeboxOptions` in route parameters.
   * @default false
   */
  decode?: boolean;
}

/**
 * Schema definition for validating request properties.
 *
 * Can be either:
 * - A TypeBox `TObject` schema wrapping all validation targets
 * - An object where each property defines validation for a specific request property
 *
 * Each property can be:
 * - A TypeBox `TSchema` (e.g., `Type.Object(...)`, `Type.String()`)
 * - A plain object with TypeBox schemas as values (e.g., `{ name: Type.String() }`)
 *
 * @example
 * ```typescript
 * // Method 1: TObject wrapper
 * const schema: ValidatorTypeboxSchema = Type.Object({
 *   body: Type.Object({ name: Type.String() })
 * });
 *
 * // Method 2: Plain object with TSchema
 * const schema: ValidatorTypeboxSchema = {
 *   body: Type.Object({ name: Type.String() }),
 *   query: Type.Object({ page: Type.String() })
 * };
 *
 * // Method 3: Plain object with TypeBox schema values
 * const schema: ValidatorTypeboxSchema = {
 *   body: {
 *     name: Type.String(),
 *     email: Type.String({ format: 'email' })
 *   }
 * };
 * ```
 */
export type ValidatorTypeboxSchema =
  | TObject
  | {
      body?: TSchema | { [x: string]: TSchema };
      headers?: TSchema | { [x: string]: TSchema };
      cookies?: TSchema | { [x: string]: TSchema };
      params?: TSchema | { [x: string]: TSchema };
      query?: TSchema | { [x: string]: TSchema };
      files?: TSchema | { [x: string]: TSchema };
    };

export type RouteSchema = {
  body?: TSchema;
  query?: TSchema;
  params?: TSchema;
  headers?: TSchema;
  cookies?: TSchema;
  files?: TSchema;
};
export type Decoded<S, K extends keyof RouteSchema, Fallback = any> =
  S extends Record<K, infer T extends TSchema> ? StaticDecode<T> : Fallback;

export type ValidatedOf<S extends RouteSchema> = {
  [K in keyof S]: S[K] extends TSchema ? StaticDecode<S[K]> : never;
};
