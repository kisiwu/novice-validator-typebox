# @novice1/validator-typebox

[![npm version](https://img.shields.io/npm/v/@novice1/validator-typebox.svg)](https://www.npmjs.com/package/@novice1/validator-typebox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[TypeBox](https://github.com/sinclairzx81/typebox) validator middleware for [@novice1/routing](https://www.npmjs.com/package/@novice1/routing).

Declare TypeBox schemas on your routes and the request is validated before your handler runs. `params`, `body`, `query`, `headers`, `cookies` and `files` are supported. Optionally, values can be **decoded** (coerced and transformed) and read back, fully typed, with `req.validated()`.

📚 [API documentation](https://kisiwu.github.io/novice-validator-typebox/latest/)

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Defining Schemas](#defining-schemas)
- [Error Handling](#error-handling)
- [Per-Route Overrides](#per-route-overrides)
- [Decoding and `req.validated()`](#decoding-and-reqvalidated)
- [API Reference](#api-reference)
- [License](#license)

## Installation

```bash
npm install @novice1/validator-typebox
```

Peer dependencies: `typebox` (^1.4.7) and `@novice1/routing` (^2.2.0).

## Quick Start

```typescript
import routing from '@novice1/routing';
import { validatorTypebox } from '@novice1/validator-typebox';
import { Type } from 'typebox';

const router = routing();

router.setValidators(
  validatorTypebox(
    { decode: false }, // options (optional)
    (err, req, res, next) => res.status(400).json(err), // error handler (optional)
    'schema' // where the schema lives in `parameters` (optional)
  )
);

router.post(
  {
    path: '/users',
    parameters: {
      schema: {
        body: Type.Object({
          name: Type.String(),
          email: Type.String({ format: 'email' }),
        }),
      },
    },
  },
  (req, res) => res.json({ success: true, data: req.body })
);
```

The third argument (`schemaProperty`) tells the validator which key of the route `parameters` holds the schema. With `'schema'`, it reads `parameters.schema`. If omitted, the whole `parameters` object is used as the schema.

## Defining Schemas

A schema maps request properties to TypeBox schemas. Three equivalent forms are accepted:

```typescript
import { Type } from 'typebox';
import type { ValidatorTypeboxSchema } from '@novice1/validator-typebox';

const bodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
});

// 1. A Type.Object wrapping the request properties
const schema1: ValidatorTypeboxSchema = Type.Object({ body: bodySchema });

// 2. A plain object whose values are TypeBox schemas
const schema2: ValidatorTypeboxSchema = { body: bodySchema };

// 3. A plain object whose values are records of TypeBox schemas
//    (each record is wrapped in Type.Object for you)
const schema3: ValidatorTypeboxSchema = {
  body: { name: Type.String(), email: Type.String({ format: 'email' }) },
};
```

Only the properties present in the schema are validated.

## Error Handling

When validation fails, the handler receives `{ errors: [...] }` and, by default, the response is `400` with that JSON body.

The error handler is resolved in this order:

1. `parameters.onerror` on the route
2. the `onError` argument of `validatorTypebox()`
3. the default: `res.status(400).json({ errors })`

Each entry looks like `{ keyword, schemaPath, instancePath, params, message }`, e.g. `instancePath: '/body/email'`, `message: 'must be string'`.

## Per-Route Overrides

```typescript
router.post(
  {
    path: '/data',
    parameters: {
      schema: { body: Type.Object({ count: Type.Number() }) },
      validatorTypeboxOptions: { decode: true }, // overrides the global options
      onerror: (err, req, res, next) => res.status(422).json(err), // overrides the global handler
    },
  },
  handler
);
```

A route-level `decode` (`true` or `false`) always wins over the global one.

## Decoding and `req.validated()`

### How it works

The `decode` option controls whether the request values are only **checked** or also **transformed** before your handler runs.

| | `decode: false` (default) | `decode: true` |
| --- | --- | --- |
| Processing | Values are checked as they are | TypeBox `Value.Decode`: defaults → type coercion → strip unknown properties → check → Codec `Decode` callbacks |
| `req.params`, `req.body`, `req.headers`, `req.cookies`, `req.files` | Untouched | Replaced by the decoded values |
| `req.query` | Untouched | Untouched (read-only in Express 5) |
| `req.validated()` | Raw values | Decoded values |

`req.validated()` is added to the request after a successful validation. It returns an object with the validated properties (`query`, `params`, `body`, `headers`, `cookies`, `files`), limited to those declared in the schema. It is the **only** place where the decoded `query` is available, so prefer it over `req.query` whenever you use `decode`.

Use optional chaining (`req.validated?.()`) because the method does not exist on routes without a schema.

### Without `decode` (default)

Values are validated exactly as received. Query strings are always strings, so a numeric schema fails:

```typescript
const querySchema = Type.Object({ page: Type.Integer() });

router.get(
  { path: '/items', parameters: { schema: { query: querySchema } } },
  (req, res) => res.json(req.validated?.().query)
);

// GET /items?page=2  ->  400
// { errors: [{ keyword: 'type', instancePath: '/query/page', message: 'must be integer', ... }] }
```

Use this mode when your schemas already describe the raw values (strings for the query string, JSON-typed values for the body).

### With `decode: true` (no codec)

TypeBox converts values to the type declared in the schema, so `Integer`, `Number` and `Boolean` work with query strings out of the box:

```typescript
import { type Static, Type } from 'typebox';

const querySchema = Type.Object({
  search: Type.String(),
  year: Type.Optional(Type.Integer()),
  includeArchived: Type.Optional(Type.Boolean()),
});

router.get(
  {
    path: '/api/items',
    parameters: {
      schema: { query: querySchema },
      validatorTypeboxOptions: { decode: true },
    },
  },
  (req, res) => {
    const { query } = req.validated?.<Static<typeof querySchema>>() ?? {};

    req.query.year; // '2005' (original string, untouched)
    query?.year; // 2005 (number)
    query?.includeArchived; // true (boolean)

    res.json(query);
  }
);

// GET /api/items?search=abc&year=2005&includeArchived=true
```

If a value cannot be converted (e.g. `?year=abc`), the request fails with a validation error.

### With `decode: true` and a custom Codec

When coercion is not enough, use [`Type.Codec`](https://github.com/sinclairzx81/typebox). A Codec declares what the incoming value may look like (the schema you pass to `Type.Codec`), and how to turn it into the value your handler wants (`Decode`). `Encode` is the inverse; it is required by TypeBox but not used by this middleware.

```typescript
import { Type, type StaticDecode } from 'typebox';

// "2005" or 2005 -> 2005 (number)
const YearParam = Type.Codec(
  Type.Union([Type.Integer(), Type.String({ pattern: '^-?\\d+$' })])
)
  .Decode((val) => Number(val))
  .Encode((val) => val);

// "true" | "false" | boolean -> boolean
const BooleanParam = Type.Codec(
  Type.Union([Type.Boolean(), Type.Literal('true'), Type.Literal('false')])
)
  .Decode((val) => val === true || val === 'true')
  .Encode((val) => val);

const querySchema = Type.Object({
  search: Type.String(),
  year: Type.Optional(YearParam),
  includeArchived: Type.Optional(BooleanParam),
});

router.get(
  {
    path: '/api/items',
    parameters: {
      schema: { query: querySchema },
      validatorTypeboxOptions: { decode: true },
    },
  },
  (req, res) => {
    // StaticDecode gives the types *after* the Codec ran
    const { query } = req.validated?.<StaticDecode<typeof querySchema>>() ?? {};

    query?.year; // number | undefined
    query?.includeArchived; // boolean | undefined
    res.json(query);
  }
);
```

> [!IMPORTANT]
> After decoding, this middleware validates the decoded values against the schema again. The schema passed to `Type.Codec` must therefore also accept the **decoded** value. That is why `YearParam` accepts `Integer | numeric string` and `BooleanParam` accepts `Boolean | 'true' | 'false'`. A Codec that returns something the inner schema rejects (e.g. a `Date` from a `Type.String()`) fails validation.

To reject a value from a `Decode` callback, `throw` an array of validation-error-like objects (same shape as above); they are passed as-is to the error handler under `errors`. Any other thrown value is wrapped as `{ errors: [thrown] }`.

```typescript
.Decode((val) => {
  const n = Number(val);
  if (!Number.isSafeInteger(n)) {
    throw [{ keyword: 'type', instancePath: '/query/year', params: { type: 'integer' }, message: 'must be integer' }];
  }
  return n;
})
```

### Typing `req.validated()`

`req.validated` takes type parameters in the order `<Query, Params, Body, Headers, Cookies, Files>`; each one is optional.

```typescript
// Without Codec: Static
req.validated?.<Static<typeof querySchema>>();

// With Codec: StaticDecode (type after decoding)
req.validated?.<StaticDecode<typeof querySchema>>();

```

> [!NOTE]
> `Static` gives the **encoded** (input) type and `StaticDecode` the **decoded** type. They are identical for schemas without a Codec.

### Good to know

- With `decode: true`, properties **not declared** in the schema are stripped from the decoded values.
- `req.query` always keeps the original strings. Use `req.validated()?.query` for decoded values.
- `req.validated` is only defined when the route has a schema and validation succeeded.

## API Reference

### `validatorTypebox(options?, onError?, schemaProperty?)`

Returns a `routing.RequestHandler`, to be registered with `router.setValidators()`.

| Parameter | Type | Description |
| --- | --- | --- |
| `options` | `{ decode?: boolean }` | Enable decoding. Default: `false`. |
| `onError` | `routing.ErrorRequestHandler` | Called with `{ errors }` on failure. Default: `400` + JSON. |
| `schemaProperty` | `string` | Key in `parameters` holding the schema. Supports nested paths (`'a.b'`). Default: the `parameters` object itself. |

Route `parameters` extras: `validatorTypeboxOptions` and `onerror`.

`ValidatorTypeboxSchema` is `TObject` or `{ body?, headers?, cookies?, params?, query?, files? }`, where each value is a `TSchema` or a record of `TSchema`.

## License

MIT
