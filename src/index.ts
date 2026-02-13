import Logger from '@novice1/logger';
import type { ErrorRequestHandler, RequestHandler, Request } from '@novice1/routing';
import type { ParamsDictionary } from 'express-serve-static-core';
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

export function validatorTypebox(onerror?: ErrorRequestHandler, schemaProperty?: string): RequestHandler {
    return function validatorTypeboxRequestHandler(req, res, next) {
        const schema = retrieveSchema(req.meta?.parameters, schemaProperty);
        if (!schema) {
            Log.silly('no schema to validate');
            return next();
        }
        const values = buildValueToValidate(schema, req);
        Log.info('validating %O', values);
        const C = Compile(schema);
        const errors = [...C.Errors(values)];
        if (errors.length) {
            Log.error('Invalid request for %s', req.originalUrl);
            const err: { errors: TLocalizedValidationError[] } = { errors };
            if (typeof req.meta.parameters?.onerror === 'function') {
                Log.error('Custom function onerror => %s', req.meta.parameters.onerror.name);
                return req.meta.parameters.onerror(err, req, res, next);
            }
            if (onerror) {
                if (typeof onerror === 'function') {
                    Log.error('Custom function onerror => %s', onerror.name);
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
        Log.info('Valid request for %s', req.originalUrl);
        return next();
    };
}
