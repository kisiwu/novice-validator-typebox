# @novice1/validator-typebox

[![npm version](https://img.shields.io/npm/v/@novice1/validator-typebox.svg)](https://www.npmjs.com/package/@novice1/validator-typebox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeBox validator middleware for [@novice1/routing](https://www.npmjs.com/package/@novice1/routing).

Provides automatic request validation for routes using [TypeBox](https://github.com/sinclairzx81/typebox) schemas. Validate `req.params`, `req.body`, `req.query`, `req.headers`, `req.cookies`, and `req.files` with full TypeScript type safety.

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Schema Definition](#schema-definition)
  - [Per-Route Overrides](#per-route-overrides)
  - [Accessing Validated Data](#accessing-validated-data)
- [API Reference](#api-reference)
- [Examples](#examples)
- [License](#license)
- [References](#references)

## Installation

```bash
npm install @novice1/validator-typebox
```

## Features

- 🎯 **Type-safe validation** using TypeBox schemas
- 🔧 **Multiple validation targets**: params, body, query, headers, cookies, files
- 🎨 **Flexible error handling** with custom error handlers
- 🔒 **TypeScript support** with type safety via `Static<typeof schema>`
- ⚡ **Easy integration** with @novice1/routing
- 🔄 **Optional parsing** to transform validated values according to schema types
- 📦 **Access validated data** via `req.validated()` function for type-safe retrieval of parsed values

## Quick Start

```typescript
import routing from '@novice1/routing';
import { validatorTypebox } from '@novice1/validator-typebox';
import { Type } from 'typebox';

const router = routing();

// Set up validator
router.setValidators(
  validatorTypebox(
    { parse: false }, // options
    (err, req, res, next) => res.status(400).json(err), // error handler
    'schema' // schema property name
  )
);

// Create validated route
router.post(
  {
    path: '/users',
    parameters: {
      schema: {
        body: Type.Object({
          name: Type.String(),
          email: Type.String({ format: 'email' })
        })
      }
    }
  },
  (req, res) => res.json({ success: true, data: req.body })
);
```

## Usage

### Schema Definition

Schemas can be defined in three ways:

```typescript
import { Type, Static } from 'typebox';
import { ValidatorTypeboxSchema } from '@novice1/validator-typebox';

const bodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' })
});

// Method 1: Type.Object wrapper
const schema1: ValidatorTypeboxSchema = Type.Object({ body: bodySchema });

// Method 2: Plain object with TSchema
const schema2: ValidatorTypeboxSchema = { body: bodySchema };

// Method 3: Plain object with schema values
const schema3: ValidatorTypeboxSchema = {
  body: {
    name: Type.String(),
    email: Type.String({ format: 'email' })
  }
};
```

### Per-Route Overrides

Override validator options or error handler for specific routes:

```typescript
router.post(
  {
    path: '/data',
    parameters: {
      schema: { body: Type.Object({ count: Type.Number() }) },
      // Override options
      validatorTypeboxOptions: { parse: true },
      // Override error handler
      onerror: (err, req, res, next) => res.status(422).json(err)
    }
  },
  handler
);
```

### Accessing Validated Data

Use `req.validated()` to access parsed values (especially useful for `query` which is readonly):

```typescript
const validated = req.validated?.<{ page?: number }>();
const page = validated?.query?.page; // number | undefined
```

## API Reference

### `validatorTypebox(options?, onError?, schemaProperty?)`

**Parameters:**

- `options?: { parse?: boolean }` - Enable parsing/transformation of validated values. Parsed values assigned back to the request object (except readonly `query`)
- `onError?: ErrorRequestHandler` - Custom error handler. Default: `res.status(400).json({ errors: [...] })`  
- `schemaProperty?: string` - Property name for schema in `req.meta.parameters`. Default: `undefined` (uses `req.meta.parameters` directly)

**Per-Route Overrides:** Use `parameters.validatorTypeboxOptions` and `parameters.onerror`

### `ValidatorTypeboxSchema`

```typescript
type ValidatorTypeboxSchema =
  | TObject
  | {
      body?: TSchema | { [x: string]: TSchema };
      headers?: TSchema | { [x: string]: TSchema };
      cookies?: TSchema | { [x: string]: TSchema };
      params?: TSchema | { [x: string]: TSchema };
      query?: TSchema | { [x: string]: TSchema };
      files?: TSchema | { [x: string]: TSchema };
    };
```

### `req.validated<Q, P, B, H, C, F>()`

Returns validated and parsed data. Available only after successful validation.

```typescript
req.validated?.<Q, P, B, H, C, F>(): {
  query?: Q, params?: P, body?: B, headers?: H, cookies?: C, files?: F
}
```

**Use case:** Access parsed `query` values (since `req.query` is readonly).

## Examples

**Basic Validation:**

```typescript
import { Type, Static } from 'typebox';
import routing from '@novice1/routing';

const userParamsSchema = Type.Object({
  id: Type.String({ pattern: '^[0-9]+$' })
});

router.get(
  {
    path: '/users/:id',
    parameters: {
      schema: { params: userParamsSchema }
    }
  },
  (req: routing.Request<Static<typeof userParamsSchema>>, res) => {
    res.json({ userId: req.params.id });
  }
);
```

**With Parsing and Validated Data Access:**

```typescript
const apiQuerySchema = Type.Object({
  search: Type.String(),
  version: Type.Optional(Type.Number()),
  includeArchived: Type.Optional(Type.Boolean())
});

router.get(
  {
    path: '/api/items',
    parameters: {
      schema: { query: apiQuerySchema },
      validatorTypeboxOptions: { parse: true }
    }
  },
  (req, res) => {
    const validated = req.validated?.<Static<typeof apiQuerySchema>>();
    const version = validated?.query?.version; // number | undefined
    
    res.json({ 
      search: req.query.search,
      version // Already a number, not a string
    });
  }
);
```

## License

MIT

## References

- [TypeBox](https://github.com/sinclairzx81/typebox)
- [@novice1/routing](https://www.npmjs.com/package/@novice1/routing)
- [npm Package](https://www.npmjs.com/package/@novice1/validator-typebox)