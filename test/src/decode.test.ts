import { validatorTypebox } from '../../src/index.js';
import routing from '@novice1/routing';
import { expect } from 'chai';
import express from 'express';
import supertest from 'supertest';
import Type from 'typebox';

describe('Set validator', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should have decoded query parameters', async () => {
    const BooleanString = Type.Codec(Type.Union([Type.Boolean(), Type.Literal('true'), Type.Literal('false')]))
      .Decode((val) => val === true || val === 'true')
      .Encode((val) => val);

    const NumberString = Type.Codec(Type.Union([Type.Number(), Type.String()]))
      .Decode((val) => (typeof val === 'number' ? val : parseInt(val)))
      .Encode((val) => val);

    const querySchema = Type.Object({
      bool: BooleanString,
      number: NumberString,
    });

    const router = routing()
      // options: decode = true to decode and validate the request automatically
      .setValidators(validatorTypebox({ decode: true }, undefined, 'schema'))
      .get(
        {
          path: '/get',
          name: 'Get',
          description: 'Test query validation',
          tags: 'Query',
          parameters: {
            schema: {
              query: querySchema,
            },
            onerror: (err, _req, res, _next) => {
              console.error(err);
              res.status(400).json(err);
            },
          },
        },
        (req, res) => {
          res.json({ validated: req.validated?.().query, original: req.query });
        }
      );

    app.use(router);

    const response = await supertest(app)
      .get('/get')
      .query({ bool: true, number: 5 })
      .set('Accept', 'application/json')
      .expect(200);
    // query parameters are always strings in the original request
    expect(response.body).to.have.property('original');
    expect(response.body.original).to.deep.equal({ bool: 'true', number: '5' });
    // validated values should match the parsed query parameters
    expect(response.body).to.have.property('validated');
    expect(response.body.validated).to.deep.equal({ bool: true, number: 5 });
  });
});
