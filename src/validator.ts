import type { ValidatedOf, ValidatorTypeboxOptions } from './types.js';
import type routing from '@novice1/routing';
import type { ParamsDictionary } from 'express-serve-static-core';
import Extend from 'extend';
import type { IncomingHttpHeaders } from 'node:http';
import type { ParsedQs } from 'qs';
import { type TObject, type TSchema, Type, IsObject, IsSchema } from 'typebox';
import { Compile } from 'typebox/compile';
import type { TLocalizedValidationError } from 'typebox/error';
import Value from 'typebox/value';

const PARAMETERS_PROPS = ['params', 'body', 'query', 'headers', 'cookies', 'files'];

interface ValidationObject {
  params?: ParamsDictionary;
  body?: unknown;
  query?: ParsedQs;
  headers?: IncomingHttpHeaders;
  cookies?: unknown;
  files?: unknown;
}

function retrieveParametersValue(
  parameters?: Record<string, unknown>,
  property?: string
): TObject | Record<string, unknown> | null {
  let schemaFromParameters: Record<string, unknown> | null = null;
  if (parameters && typeof parameters === 'object') {
    schemaFromParameters = parameters;
    if (property && typeof property === 'string') {
      // retrieve nested object property
      const subParameters = property
        .replace(/\[([^[\]]*)\]/g, '.$1.')
        .split('.')
        .filter((t) => t !== '')
        .reduce((prev: unknown, curr) => {
          if (prev && typeof prev === 'object' && curr in prev) {
            const tmp: unknown = prev[curr as keyof typeof prev];
            return tmp;
          }
          return;
        }, schemaFromParameters);
      if (subParameters && typeof subParameters === 'object' && !Array.isArray(subParameters)) {
        schemaFromParameters = subParameters as Record<string, unknown>;
      } else {
        schemaFromParameters = null;
      }
    }
  }
  return schemaFromParameters;
}

function retrieveSchema(parameters?: Record<string, unknown>, property?: string): TObject | null {
  const v = retrieveParametersValue(parameters, property);
  if (v) {
    let schema: TObject | null = null;
    let tempValue = v;
    // check if schema is a valid schema
    if (tempValue) {
      // if it is not a TSchema
      if (!IsObject(tempValue)) {
        const tmpSchema: Record<string, TSchema> = {};
        const currentSchema: Record<string, unknown> = tempValue;
        PARAMETERS_PROPS.forEach((p) => {
          const currentSchemaValue = currentSchema[p];
          if (currentSchemaValue && typeof currentSchemaValue === 'object') {
            if (IsSchema(currentSchemaValue)) tmpSchema[p] = currentSchemaValue;
            else {
              tmpSchema[p] = Type.Object(currentSchemaValue);
            }
          }
        });
        if (Object.keys(tmpSchema).length) {
          tempValue = Type.Object(tmpSchema);
        } else {
          tempValue = tmpSchema;
        }
      }

      // if it is a Joi.ObjectSchema
      if (tempValue?.type == 'object' && IsObject(tempValue)) {
        schema = tempValue;
      }
    }
    return schema;
  }
  return v;
}

function buildValueToValidate(schema: object, req: routing.Request): ValidationObject {
  const r: ValidationObject = {}; //'params', 'body', 'query', 'headers', 'cookies', 'files'
  if ('properties' in schema && schema.properties && typeof schema.properties === 'object') {
    const properties = schema.properties;
    if ('params' in properties) {
      r.params = req.params;
    }
    if ('body' in properties) {
      r.body = req.body;
    }
    if ('query' in properties) {
      r.query = req.query;
    }
    if ('headers' in properties) {
      r.headers = req.headers;
    }
    if ('cookies' in properties) {
      r.cookies = req.cookies;
    }
    if ('files' in properties) {
      r.files = req.files;
    }
  }
  return r;
}

/**
 * Creates a TypeBox validator middleware for use with @novice1/routing.
 *
 * Validates request properties (params, body, query, headers, cookies, files) against TypeBox schemas.
 * The validator can be configured globally and overridden per-route.
 *
 * @param options - Configuration options for the validator
 * @param onerror - Error handler called when validation fails. If not provided, returns HTTP 400 with error details.
 * @param schemaProperty - Name of the route parameter property containing the schema.
 *                         If undefined, uses `req.meta.parameters` directly as the schema.
 *                         If specified (e.g., 'schema'), looks for the schema at `req.meta.parameters.schema`.
 *
 * @returns A request handler middleware function that validates incoming requests
 *
 * @example
 * ```typescript
 * import routing from '@novice1/routing';
 * import { validatorTypebox } from '@novice1/validator-typebox';
 * import { Type } from 'typebox';
 *
 * const router = routing();
 *
 * // Set up validator with custom error handler
 * router.setValidators(
 *   validatorTypebox(
 *     { decode: true },
 *     (err, req, res, next) => {
 *       res.status(400).json({ error: 'Validation failed', details: err });
 *     },
 *     'schema'
 *   )
 * );
 *
 * // Create validated route
 * router.post(
 *   {
 *     path: '/users',
 *     parameters: {
 *       schema: {
 *         body: Type.Object({
 *           name: Type.String(),
 *           email: Type.String({ format: 'email' })
 *         })
 *       }
 *     }
 *   },
 *   (req, res) => {
 *     res.json({ success: true, data: req.body });
 *   }
 * );
 * ```
 */
export function validatorTypebox(
  options?: ValidatorTypeboxOptions,
  onerror?: routing.ErrorRequestHandler,
  schemaProperty?: string
): routing.RequestHandler {
  return function validatorTypeboxRequestHandler(req, res, next) {
    const schema = retrieveSchema(req.meta?.parameters, schemaProperty);
    if (!schema) {
      return next();
    }

    const propagateError = (err: { errors: unknown[] }) => {
      if (typeof req.meta.parameters?.onerror === 'function') {
        return req.meta.parameters.onerror(err, req, res, next);
      }
      if (onerror) {
        if (typeof onerror === 'function') {
          return onerror(err, req, res, next);
        }
      }
      return res.status(400).json(err);
    };

    const values = buildValueToValidate(schema, req);
    const C = Compile(schema);
    let decodedValues = values;
    const decodeEnabled =
      (typeof req.meta.parameters?.validatorTypeboxOptions?.decode === 'boolean' &&
        req.meta.parameters?.validatorTypeboxOptions?.decode) ||
      (typeof req.meta.parameters?.validatorTypeboxOptions?.decode === 'undefined' && options?.decode) ||
      false;
    if (decodeEnabled) {
      decodedValues.query = { ...decodedValues.query };

      try {
        decodedValues = Value.Decode(schema, decodedValues);
        // because 'query' is readonly since Express v5
        const { query: _, ...validatedProps } = decodedValues;
        Extend(req, validatedProps);
      } catch (e) {
        const err: { errors: unknown[] } = { errors: Array.isArray(e) ? e : [e] };
        return propagateError(err);
      }
    }
    const errors: TLocalizedValidationError[] = [...C.Errors(decodedValues)];
    if (errors.length) {
      const err: { errors: TLocalizedValidationError[] } = { errors };
      return propagateError(err);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as routing.Request & { validated: () => ValidatedOf<any> }).validated = () => decodedValues as any;
    return next();
  };
}

export function routeValidatorTypebox(options?: ValidatorTypeboxOptions, onerror?: routing.ErrorRequestHandler) {
  return validatorTypebox(options, onerror, 'typeboxSchema');
}
