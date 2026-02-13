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
  - [Setting Up the Validator](#setting-up-the-validator)
  - [Defining Schemas](#defining-schemas)
  - [Creating Validated Routes](#creating-validated-routes)
  - [Error Handling Overrides](#error-handling-overrides)
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
- 🔒 **TypeScript support** with full type inference
- ⚡ **Easy integration** with @novice1/routing

## Quick Start

```typescript
import routing from '@novice1/routing';
import { validatorTypebox } from '@novice1/validator-typebox';
import { Type } from 'typebox';

const router = routing();

// Set up the validator
router.setValidators(
  validatorTypebox(
    (err, req, res, next) => {
      res.status(400).json({ error: 'Validation failed', details: err });
    },
    'schema'
  )
);

// Create a validated route
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
  (req, res) => {
    res.json({ success: true, data: req.body });
  }
);
```

## Usage

### Setting Up the Validator

Create a router instance and configure the TypeBox validator:

```typescript
// router.ts
import routing from '@novice1/routing';
import { validatorTypebox } from '@novice1/validator-typebox';

const router = routing();

router.setValidators(
  validatorTypebox(
    // Error handler middleware (called when validation fails)
    function onError(err, req, res, next) {
      res.status(400).json({
        error: 'Validation failed',
        details: err
      });
    },
    // Property name containing the schema
    'schema'
  )
);

export default router;
```

### Defining Schemas

Define TypeBox schemas for your route parameters:

```typescript
// schema.ts
import { Type, Static } from 'typebox';
import { ValidatorTypeboxSchema } from '@novice1/validator-typebox';

// Define schema for request body
const bodySchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' }),
  age: Type.Optional(Type.Number({ minimum: 0 }))
});

// Extract TypeScript type from schema
export type BodyItem = Static<typeof bodySchema>;

// Method 1: Using Type.Object wrapper
export const routeSchema: ValidatorTypeboxSchema = Type.Object({
  body: bodySchema
});

// Method 2: Using plain object
// export const routeSchema: ValidatorTypeboxSchema = {
//   body: bodySchema
// };

// Method 3: Plain object with TypeBox schema values (no Type.Object wrapper)
// export const routeSchema: ValidatorTypeboxSchema = {
//   body: {
//     name: Type.String(),
//     email: Type.String({ format: 'email' }),
//     age: Type.Optional(Type.Number({ minimum: 0 }))
//   }
// };
```

### Creating Validated Routes

Create routes with automatic validation:

```typescript
// routes.ts
import routing from '@novice1/routing';
import express from 'express';
import router from './router';
import { BodyItem, routeSchema } from './schema';

router.post(
  {
    name: 'Create Item',
    path: '/items',
    parameters: {
      // Attach the validation schema
      schema: routeSchema
    },
    // Body parser middleware (runs before validation)
    preValidators: express.json()
  },
  function (req: routing.Request<unknown, unknown, BodyItem>, res) {
    // req.body is now validated and typed
    res.status(201).json({
      success: true,
      item: {
        name: req.body.name,
        email: req.body.email
      }
    });
  }
);
```

### Error Handling Overrides

Override the global error handler for specific routes:

```typescript
import routing from '@novice1/routing';
import router from './router';

// Custom error handler for this route
const customErrorHandler: routing.ErrorRequestHandler = (err, req, res, next) => {
  console.error('Validation error:', err);
  res.status(422).json({
    error: 'Invalid input',
    message: 'Please check your request data',
    details: err
  });
};

router.get(
  {
    path: '/special-route',
    parameters: {
      schema: {
        query: Type.Object({
          search: Type.String()
        })
      },
      // Override error handler for this route only
      onerror: customErrorHandler
    }
  },
  function (req, res) {
    res.json({ results: [] });
  }
);
```

## API Reference

### `validatorTypebox(onError?, schemaProperty?)`

Creates a TypeBox validator middleware for use with @novice1/routing.

**Parameters:**

- `onError` (optional): Error handler middleware function called when validation fails
  - Type: `(err: any, req: Request, res: Response, next: NextFunction) => void`
  - Default: Returns HTTP 400 status with validation errors as JSON: `res.status(400).json({ errors: [...] })`
- `schemaProperty` (optional): Name of the route parameter property containing the schema
  - Type: `string`
  - Default: `undefined` (uses `req.meta.parameters` directly as the schema instead of a nested property like `req.meta.parameters.schema`)

**Returns:** Validator middleware function

### `ValidatorTypeboxSchema`

Type definition for validation schemas. Can validate multiple request properties:

```typescript
import type { TObject, TSchema } from 'typebox';

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

Each property can be either:
- A TypeBox `TSchema` (like `Type.Object(...)`, `Type.String()`, etc.)
- A plain object with TypeBox schemas as values (e.g., `{ name: Type.String() }`)

## Examples

**Validating Query Parameters:**

```typescript
import { Type, Static } from 'typebox';
import routing from '@novice1/routing';
import router from './router';

// Define the query schema
const searchQuerySchema = Type.Object({
  q: Type.String({ minLength: 1 }),
  page: Type.Optional(Type.String({ pattern: '^[0-9]+$' })),
  limit: Type.Optional(Type.String())
});

router.get(
  {
    path: '/search',
    parameters: {
      schema: {
        query: searchQuerySchema
      }
    }
  },
  (req: routing.Request<unknown, unknown, unknown, Static<typeof searchQuerySchema>>, res) => {
    const { q, page = '1', limit = '10' } = req.query;
    res.json({ 
      query: q, 
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  }
);
```

**Validating Route Parameters:**

```typescript
import { Type, Static } from 'typebox';
import routing from '@novice1/routing';
import router from './router';

// Define the params schema
const userParamsSchema = Type.Object({
  id: Type.String({ pattern: '^[0-9]+$' })
});

router.get(
  {
    path: '/users/:id',
    parameters: {
      schema: {
        params: userParamsSchema
      }
    }
  },
  (req: routing.Request<Static<typeof userParamsSchema>>, res) => {
    res.json({ userId: req.params.id });
  }
);
```

## License

MIT

## References

- [TypeBox](https://github.com/sinclairzx81/typebox)
- [@novice1/routing](https://www.npmjs.com/package/@novice1/routing)
- [npm Package](https://www.npmjs.com/package/@novice1/validator-typebox)