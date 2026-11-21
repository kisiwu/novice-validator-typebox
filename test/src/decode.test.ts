import { validatorTypebox, type ValidatorTypeboxOptions } from '../../src/index.js';
import routing from '@novice1/routing';
import { expect } from 'chai';
import express from 'express';
import supertest from 'supertest';
import Type, { type Static, type StaticDecode } from 'typebox';

// keep decode option to true
const options: ValidatorTypeboxOptions = { decode: true } as const;

describe('Routing with decode', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  /**
   * When the decode option is set to false, query parameters are not automatically decoded.
   */
  it('should not have decoded query parameters', async () => {
    const apiQuerySchema = Type.Object({
      search: Type.String(),
      year: Type.Optional(Type.Number()),
      includeArchived: Type.Optional(Type.Boolean()),
    });

    const router = routing()
      .setValidators(validatorTypebox(undefined, undefined, 'schema'))
      .get(
        {
          path: '/api/items',
          parameters: {
            schema: { query: apiQuerySchema },
            validatorTypeboxOptions: { decode: false },
          },
        },
        (req, res) => {
          const validated = req.validated?.<Static<typeof apiQuerySchema>>();
          const search = validated?.query?.search; // string | undefined
          const year = validated?.query?.year; // number | undefined
          const includeArchived = validated?.query?.includeArchived; // boolean | undefined

          res.json({
            original: req.query,
            data: {
              search,
              year,
              includeArchived,
            },
          });
        }
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2025, includeArchived: true })
      .set('Accept', 'application/json')
      .expect(400);
    expect(response.body).to.have.property('errors');
    expect(response.body.errors).to.be.an('array');
    expect(response.body.errors).to.deep.equal([
      {
        keyword: 'type',
        schemaPath: '#/properties/query/properties/year',
        instancePath: '/query/year',
        params: { type: 'number' },
        message: 'must be number',
      },
      {
        keyword: 'type',
        schemaPath: '#/properties/query/properties/includeArchived',
        instancePath: '/query/includeArchived',
        params: { type: 'boolean' },
        message: 'must be boolean',
      },
    ]);
  });

  /**
   * Should automatically decode query parameters when the decode option is set to true.
   */
  it('should have decoded query parameters when decode is true', async () => {
    const apiQuerySchema = Type.Object({
      search: Type.String(),
      year: Type.Optional(Type.Number()),
      includeArchived: Type.Optional(Type.Boolean()),
    });

    const router = routing()
      .setValidators(validatorTypebox(undefined, undefined, 'schema'))
      .get(
        {
          path: '/api/items',
          parameters: {
            schema: { query: apiQuerySchema },
            validatorTypeboxOptions: options,
          },
        },
        (req, res) => {
          // using StaticDecode to get the decoded types of the query parameters
          const validated = req.validated?.<Static<typeof apiQuerySchema>>();
          const search = validated?.query?.search; // string | undefined
          const year = validated?.query?.year; // number | undefined
          const includeArchived = validated?.query?.includeArchived; // boolean | undefined

          res.json({
            original: req.query,
            data: {
              search,
              year,
              includeArchived,
            },
          });
        }
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2025, includeArchived: true })
      .set('Accept', 'application/json')
      .expect(200);
    // query parameters are always strings in the original request
    expect(response.body).to.have.property('original');
    expect(response.body.original).to.deep.equal({
      search: 'Get It How You Live',
      year: '2025',
      includeArchived: 'true',
    });
    // validated values should match the decoded query parameters
    expect(response.body).to.have.property('data');
    expect(response.body.data).to.deep.equal({ search: 'Get It How You Live', year: 2025, includeArchived: true });
  });

  /**
   * Should be able to decode query parameters using Codec definitions instead of relying on default parsing.
   */
  it('should have decoded query parameters', async () => {
    const apiQuerySchema = Type.Object({
      search: Type.String(),
      year: Type.Optional(
        Type.Codec(Type.Union([Type.Number(), Type.String()])) // allow number or string
          .Decode((val) => (typeof val === 'string' && !isNaN(parseInt(val)) ? parseInt(val) : val))
          .Encode((val) => val)
      ),
      includeArchived: Type.Optional(
        Type.Codec(Type.Union([Type.Boolean(), Type.Literal('true'), Type.Literal('false')]))
          .Decode((val) => val === true || val === 'true')
          .Encode((val) => val)
      ),
    });

    const router = routing()
      .setValidators(validatorTypebox(undefined, undefined, 'schema'))
      .get(
        {
          path: '/api/items',
          parameters: {
            schema: { query: apiQuerySchema },
            validatorTypeboxOptions: options,
          },
        },
        (req, res) => {
          // using StaticDecode to get the decoded types of the query parameters
          const validated = req.validated?.<StaticDecode<typeof apiQuerySchema>>();
          const search = validated?.query?.search; // string | undefined
          const year = validated?.query?.year; // number | undefined
          const includeArchived = validated?.query?.includeArchived; // boolean | undefined

          res.json({
            original: req.query,
            data: {
              search,
              year,
              includeArchived,
            },
          });
        }
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2025, includeArchived: true })
      .set('Accept', 'application/json')
      .expect(200);
    // query parameters are always strings in the original request
    expect(response.body).to.have.property('original');
    expect(response.body.original).to.deep.equal({
      search: 'Get It How You Live',
      year: '2025',
      includeArchived: 'true',
    });
    // validated values should match the decoded query parameters
    expect(response.body).to.have.property('data');
    expect(response.body.data).to.deep.equal({ search: 'Get It How You Live', year: 2025, includeArchived: true });
  });
});
