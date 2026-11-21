```ts
import Type from 'typebox'
import Value from 'typebox/value'

const BooleanString = Type.Codec(
  Type.Union([
    Type.Boolean(),
    Type.Literal('true'),
    Type.Literal('false'),
  ])
)
  .Decode((val) => val === true || val === 'true')
  .Encode((val) => val)

const Schema = Type.Object({
  isActive: BooleanString,
})

// Infers { isActive: boolean }
type SchemaType = Type.StaticDecode<typeof Schema>

const parsed = Value.Decode(Schema, { isActive: 'true' })
// Result: { isActive: true }

```