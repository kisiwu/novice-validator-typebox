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
  - [Overriding Validator Options Per Route](#overriding-validator-options-per-route)
  - [Accessing Validated Data](#accessing-validated-data)
- [API Reference](#api-reference)
  - [ValidatorTypeboxOptions](#validatortypeboxoptions)
  - [validatorTypebox()](#validatortypeboxoptions-onerror-schemaproperty)
  - [ValidatorTypeboxSchema](#validatortypeboxschema-1)
  - [req.validated()](#reqvalidatedq-p-b-h-c-f)
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
- 🔄 **Optional parsing** to transform validated values according to schema types
- 📦 **Access validated data** via `req.validated()` function for type-safe retrieval of parsed values

## Quick Start

```typescript
import routing from '@novice1/routing';
import { validatorTypebox } from '@novice1/validator-typebox';
import { Type } from 'typebox';

const router = routing();

// Set up the validator
router.setValidators(
  validatorTypebox(
    { parse: false },
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
    // Configuration options
    { parse: false },
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

### Overriding Validator Options Per Route

You can override the global validator options for specific routes using `validatorTypeboxOptions`:

```typescript
import routing from '@novice1/routing';
import { Type } from 'typebox';
import router from './router';

// Global validator has parse disabled
router.setValidators(
  validatorTypebox(
    { parse: false },
    (err, req, res, next) => res.status(400).json(err),
    'schema'
  )
);

// Enable parse for this specific route only
router.post(
  {
    path: '/data',
    parameters: {
      schema: {
        body: Type.Object({
          count: Type.Number(),
          enabled: Type.Boolean()
        })
      },
      // Override: enable parse for this route
      validatorTypeboxOptions: {
        parse: true
      }
    }
  },
  (req, res) => {
    // req.body.count is now a number (parsed from string)
    // req.body.enabled is now a boolean (parsed from string)
    res.json({ received: req.body });
  }
);
```

### Accessing Validated Data

After successful validation, you can access validated (and potentially parsed) data using the `req.validated()` function. This is particularly useful for accessing parsed query parameters, since `req.query` is readonly and cannot be modified:

```typescript
import routing from '@novice1/routing';
import { Type, Static } from 'typebox';
import router from './router';

// Set up validator with parse enabled
router.setValidators(
  validatorTypebox(
    { parse: true },
    (err, req, res, next) => res.status(400).json(err),
    'schema'
  )
);

// Define a query schema with numeric values
const searchSchema = Type.Object({
  q: Type.String(),
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 }))
});

type SearchQuery = Static<typeof searchSchema>;

router.get(
  {
    path: '/search',
    parameters: {
      schema: {
        query: searchSchema
      }
    }
  },
  (req: routing.Request<unknown, unknown, unknown, SearchQuery>, res) => {
    // Method 1: Access parsed data via req.validated()
    const validated = req.validated?.<SearchQuery>();
    const page = validated?.query?.page ?? 1; // page is number
    const limit = validated?.query?.limit ?? 10; // limit is number
    
    // Method 2: req.query still works but values remain as strings
    // const page = parseInt(req.query.page ?? '1', 10);
    
    res.json({
      query: req.query.q,
      page, // Already a number
      limit // Already a number
    });
  }
);
```

**TypeScript Signature:**

```typescript
req.validated?.<Q, P, B, H, C, F>(): {
  query?: Q
  params?: P
  body?: B
  headers?: H
  cookies?: C
  files?: F
}
```

Where:
- `Q` = Query type
- `P` = Params type
- `B` = Body type
- `H` = Headers type
- `C` = Cookies type
- `F` = Files type

## API Reference

### `ValidatorTypeboxOptions`

Configuration options interface for the TypeBox validator.

**Properties:**

- `parse?: boolean` - When `true`, enables parsing and transformation of validated values according to the schema. Parsed values are assigned back to the request object (except `query` which is readonly). Can be overridden per-route by setting `validatorTypeboxOptions` in route parameters. Default: `false`

**Per-Route Override:**

You can override these options for specific routes by setting `validatorTypeboxOptions` in the route's `parameters`:

```typescript
router.post({
  path: '/data',
  parameters: {
    schema: { /* ... */ },
    validatorTypeboxOptions: {
      parse: true // Override global settings
    }
  }
}, handler);
```

### `validatorTypebox(options?, onError?, schemaProperty?)`

Creates a TypeBox validator middleware for use with @novice1/routing.

**Parameters:**

- `options` (optional): Configuration options for the validator
  - Type: `ValidatorTypeboxOptions`
  - Properties:
    - `parse?: boolean` - When `true`, enables parsing and transformation of validated values. Parsed values will be assigned back to the request object (except query which is readonly). Can be overridden per-route using `validatorTypeboxOptions` in route parameters.
  - Default: `undefined`
- `onError` (optional): Error handler middleware function called when validation fails
  - Type: `(err: any, req: Request, res: Response, next: NextFunction) => void`
  - Default: Returns HTTP 400 status with validation errors as JSON: `res.status(400).json({ errors: [...] })`
  - Can be overridden per-route using `onerror` in route parameters
- `schemaProperty` (optional): Name of the route parameter property containing the schema
  - Type: `string`
  - Default: `undefined` (uses `req.meta.parameters` directly as the schema instead of a nested property like `req.meta.parameters.schema`)

**Returns:** Validator middleware function

**Per-Route Overrides:**

Both `options` and `onError` can be overridden for specific routes via route parameters:
- Override options: `parameters.validatorTypeboxOptions`
- Override error handler: `parameters.onerror`

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

### `req.validated<Q, P, B, H, C, F>()`

Function available on the request object after successful validation. Returns validated (and potentially parsed) data.

**Type Parameters:**

- `Q` - Query parameters type
- `P` - Route parameters type
- `B` - Body type
- `H` - Headers type
- `C` - Cookies type
- `F` - Files type

**Returns:**

```typescript
{
  query?: Q
  params?: P
  body?: B
  headers?: H
  cookies?: C
  files?: F
  [x: string]: unknown
}
```

**Availability:** This function is only available after the request has been validated against a schema.

**Use Case:** Primarily useful when `parse: true` is enabled to access parsed query parameters, since `req.query` is readonly and cannot be modified by TypeBox parsing.

**Example:**

```typescript
const validated = req.validated?.<{ version?: number }>();
const version = validated?.query?.version; // number | undefined (not string)
```

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

**Using Parse Option:**

```typescript
import { Type, Static } from 'typebox';
import routing from '@novice1/routing';
import express from 'express';
import router from './router';

// Set up validator with parse enabled
router.setValidators(
  validatorTypebox(
    { parse: true },
    (err, req, res, next) => {
      res.status(400).json({ error: err });
    },
    'schema'
  )
);

// Define schema with transformations
const createUserSchema = Type.Object({
  name: Type.String(),
  age: Type.Number(), // Will parse string to number if parse is enabled
  active: Type.Boolean() // Will parse string to boolean if parse is enabled
});

router.post(
  {
    path: '/users',
    parameters: {
      schema: {
        body: createUserSchema
      }
    },
    preValidators: express.json()
  },
  (req: routing.Request<unknown, unknown, Static<typeof createUserSchema>>, res) => {
    // req.body values are now parsed and transformed
    res.json({ user: req.body });
  }
);
```

**Accessing Parsed Query Parameters:**

```typescript
import { Type, Static } from 'typebox';
import routing from '@novice1/routing';
import router from './router';

// Define query schema with numeric and boolean types
const apiQuerySchema = Type.Object({
  search: Type.String(),
  version: Type.Optional(Type.Number()),
  includeArchived: Type.Optional(Type.Boolean())
});

type ApiQuery = Static<typeof apiQuerySchema>;

router.get(
  {
    path: '/api/items',
    parameters: {
      schema: {
        query: apiQuerySchema
      },
      // Enable parse for this route to transform query values
      validatorTypeboxOptions: {
        parse: true
      }
    }
  },
  (req: routing.Request<unknown, unknown, unknown, ApiQuery>, res) => {
    // Use req.validated() to access parsed query values
    // This is necessary because req.query is readonly and not parsed
    const validated = req.validated?.<ApiQuery>();
    const version = validated?.query?.version; // number | undefined
    const includeArchived = validated?.query?.includeArchived; // boolean | undefined
    
    res.json({ 
      search: req.query.search,
      version, // Already a number, not a string
      includeArchived // Already a boolean, not a string
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