import type { RouteSchema, ValidatedOf, ValidatorTypeboxOptions } from './types.js';
import type routing from '@novice1/routing';
import type * as core from 'express-serve-static-core';
import type qs from 'qs';
import type { StaticDecode, TSchema } from 'typebox';

export interface Controller<
  P = core.ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = qs.ParsedQs,
  Locals extends Record<string, any> = Record<string, any>,
  MetaResType = any,
> {
  (
    req: routing.Request<P, ResBody, ReqBody, ReqQuery, Locals, MetaResType>,
    res: core.Response<ResBody, Locals>,
    next: core.NextFunction
  ):
    | ResBody
    | void
    | core.Response<ResBody, Locals>
    | Promise<ResBody>
    | Promise<void>
    | Promise<core.Response<ResBody, Locals>>;
}

export interface SchemaController<P, ResBody, ReqBody, ReqQuery, Locals extends Record<string, any>, MetaResType, V> {
  (
    req: routing.Request<P, ResBody, ReqBody, ReqQuery, Locals, MetaResType> & { validated?(): V },
    res: core.Response<ResBody, Locals>,
    next: core.NextFunction
  ): ReturnType<Controller<P, ResBody, ReqBody, ReqQuery, Locals, MetaResType>>;
}

type OutputOf<S, K extends string, Fallback> = S extends { [P in K]: infer T }
  ? T extends TSchema
    ? StaticDecode<T>
    : Fallback
  : Fallback;

type ParamsOf<Path, S> = OutputOf<
  S,
  'params',
  Path extends string ? core.RouteParameters<Path> : core.ParamsDictionary
>;

export type SchemaMethodSettings<
  Path,
  S extends RouteSchema,
  ResBody,
  Locals extends Record<string, any>,
  MetaResType,
> = routing.RouteSettings<Path, core.ParamsDictionary, ResBody, any, qs.ParsedQs, Locals, MetaResType> & {
  schema: S;
  options?: ValidatorTypeboxOptions | undefined;
  onerror?: routing.ErrorRequestHandler | undefined;
};

export type SchemaHandlersFor<
  Path,
  S extends RouteSchema,
  ResBody,
  Locals extends Record<string, any>,
  MetaResType,
> = SchemaController<
  ParamsOf<Path, S>,
  ResBody,
  OutputOf<S, 'body', any>,
  qs.ParsedQs,
  Locals,
  MetaResType,
  ValidatedOf<S>
>[];

export type SchemaRouteTuple<
  Path,
  S extends RouteSchema,
  ResBody,
  Locals extends Record<string, any>,
  MetaResType,
> = readonly [
  routing.RouteSettings<Path, ParamsOf<Path, S>, ResBody, OutputOf<S, 'body', any>, qs.ParsedQs, Locals, MetaResType>,
  ...SchemaHandlersFor<Path, S, ResBody, Locals, MetaResType>,
];

export function route<
  Path extends core.PathParams,
  S extends RouteSchema,
  ResBody,
  Locals extends Record<string, any>,
  MetaResType,
>(
  settings: SchemaMethodSettings<Path, S, ResBody, Locals, MetaResType>,
  ...handlers: SchemaHandlersFor<Path, S, ResBody, Locals, MetaResType>
): SchemaRouteTuple<Path, S, ResBody, Locals, MetaResType> {
  const { schema, options, onerror, parameters, ...rest } = settings;
  return [
    {
      ...rest,
      parameters: {
        ...parameters,
        typeboxSchema: schema,
        ...((options && { validatorTypeboxOptions: options }) || {}),
        ...((onerror && { onerror }) || {}),
      },
    },
    ...handlers,
  ] as const;
}

export function withSettings<Path extends core.PathParams, S extends RouteSchema>(
  settings: SchemaMethodSettings<Path, S, any, Record<string, any>, any>
) {
  return {
    route<ResBody = any, Locals extends Record<string, any> = Record<string, any>, MetaResType = any>(
      ...handlers: SchemaHandlersFor<Path, S, ResBody, Locals, MetaResType>
    ): SchemaRouteTuple<Path, S, ResBody, Locals, MetaResType> {
      return route(settings, ...handlers);
    },
  };
}

/*
const args = route(
  {
    path: '/users',
    parameters: {
      schema: {
        body: {}
      },
      nux: 4,
    },
  },
  (req, res) => {
    req.validated();
  }
);
*/

// usage: router.post(...route({ path: '/users', parameters: { schema: { body: UserSchema } } }, (req, res) => { req.body.name }));
