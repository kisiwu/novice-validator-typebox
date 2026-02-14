import Logger from '@novice1/logger';
import type { ErrorRequestHandler, RequestHandler, Request } from '@novice1/routing';
import type { ParamsDictionary } from 'express-serve-static-core';
import Extend from 'extend';
import type { IncomingHttpHeaders } from 'node:http';
import type { ParsedQs } from 'qs';
import { type TObject, type TSchema, Type, IsObject, IsSchema } from 'typebox';
import { Compile } from 'typebox/compile';
import { TLocalizedValidationError } from 'typebox/error';

const Log = Logger.debugger('@novice1/validator-typebox');
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

function buildValueToValidate(schema: object, req: Request): ValidationObject {
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
 * Options for configuring the TypeBox validator behavior.
 */
export interface ValidatorTypeboxOptions {
    /**
     * When `true`, enables parsing and transformation of validated values.
     * Parsed values will be assigned back to the request object (except query which is readonly).
     * Can be overridden per-route using `validatorTypeboxOptions` in route parameters.
     * @default false
     */
    parse?: boolean;
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
 *     { parse: true },
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
    onerror?: ErrorRequestHandler,
    schemaProperty?: string
): RequestHandler {
    return function validatorTypeboxRequestHandler(req, res, next) {
        const schema = retrieveSchema(req.meta?.parameters, schemaProperty);
        if (!schema) {
            Log.silly('no schema to validate');
            return next();
        }
        const values = buildValueToValidate(schema, req);
        Log.debug('validating %O', values);
        const C = Compile(schema);
        let parsedValues = values;
        const parseEnabled =
            (typeof req.meta.parameters?.validatorTypeboxOptions === 'boolean' &&
                req.meta.parameters?.validatorTypeboxOptions) ||
            (typeof req.meta.parameters?.validatorTypeboxOptions === 'undefined' && options?.parse) ||
            false;
        if (parseEnabled) {
            try {
                parsedValues = C.Parse(parsedValues);
                Log.debug('Parsed and validated %O', parsedValues);

                // because 'query' is readonly since Express v5
                const { query, ...validatedProps } = parsedValues;
                Log.debug('Validated query %o', query);
                Extend(req, validatedProps);
            } catch (err) {
                Log.error(err);
            }
        }
        const errors: TLocalizedValidationError[] = [...C.Errors(parsedValues)];
        if (errors.length) {
            Log.error('Invalid request for %s', req.originalUrl);
            const err: { errors: TLocalizedValidationError[] } = { errors };
            if (typeof req.meta.parameters?.onerror === 'function') {
                Log.debug('Custom function onerror => %s', req.meta.parameters.onerror.name);
                return req.meta.parameters.onerror(err, req, res, next);
            }
            if (onerror) {
                if (typeof onerror === 'function') {
                    Log.debug('Custom function onerror => %s', onerror.name);
                    return onerror(err, req, res, next);
                } else {
                    Log.warn(
                        'Expected arg 2 ("onerror") to be a function (ErrorRequestHandler). Instead got type "%s"',
                        typeof onerror
                    );
                }
            }
            return res.status(400).json(err);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req.validated = () => parsedValues as any;
        Log.info('Valid request for %s', req.originalUrl);
        return next();
    };
}
