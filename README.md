# @novice1/validator-typebox

Typebox validator to use with [@novice1/routing](https://www.npmjs.com/package/@novice1/routing).

It provides a middleware that can validate `req.params`, `req.body`, `req.query`, `req.headers`, `req.cookies` and `req.files` against a schema using [@sinclair/typebox](https://www.npmjs.com/package/@sinclair/typebox).

## Installation

```bash
npm install @novice1/validator-typebox
```

## Usage

### Set validator

```ts
// router.ts

import routing from '@novice1/routing'
import { validatorTypebox } from '@novice1/validator-typebox'

export default const router = routing()

router.setValidators(
  validatorTypebox(
    // middleware in case validation fails
    function onerror(err, req, res, next) {
      res.status(400).json(err)
    }
    // name of the property containing the schema
    'schema'
  )
)
```

### Create schema 

```ts
// schema.ts

import { Type, Static } from '@sinclair/typebox'
import { ValidatorTypeboxSchema } from '@novice1/validator-typebox'
import router from './router'

// schema for "req.body"
const bodySchema = Type.Object({                
  name: Type.String()                            
})

// type for "req.body"
export type BodyItem = Static<typeof bodySchema>

export const routeSchema: ValidatorTypeboxSchema = Type.Object({
    body: bodySchema
})

// or
/*
export const routeSchema: ValidatorTypeboxSchema = {
    body: bodySchema
}
*/

// or
/*
export const routeSchema: ValidatorTypeboxSchema = {
    body: {                
        name: Type.String()                            
    }
}
*/
```

### Create route

```ts
import routing from '@novice1/routing'
import express from 'express'
import router from './router'
import { BodyItem, routeSchema } from './schema'

router.post(
  {
    name: 'Post item',
    path: '/items',

    parameters: {
        // the schema to validate
        schema: routeSchema
    },

    // body parser
    preValidators: express.json()
  },
  function (req: routing.Request<unknown, { name: string }, BodyItem>, res) {
    res.json({ name: req.body.name })
  }
)
```

### Overrides

Override the validator's error handler for a route.

```ts
import routing from '@novice1/routing'
import router from './router'

const onerror: routing.ErrorRequestHandler = (err, req, res) => {
  res.status(400).json(err)
}

router.get(
  {
    path: '/override',
    parameters: {
      // overrides
      onerror

    },
  },
  function (req, res) {
    // ...
  }
)
```

## References

- [TypeBox](https://www.npmjs.com/package/@sinclair/typebox)
- [@novice1/routing](https://www.npmjs.com/package/@novice1/routing)