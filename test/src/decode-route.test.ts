import { type ValidatorTypeboxOptions, route, routeValidatorTypebox } from '../../src/index.js';
import routing from '@novice1/routing';
import { expect } from 'chai';
import express from 'express';
import supertest from 'supertest';
import Type from 'typebox';

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
      year: Type.Optional(Type.Integer()),
      includeArchived: Type.Optional(Type.Boolean()),
    });

    const router = routing()
      .setValidators(routeValidatorTypebox())
      .get(
        ...route(
          {
            path: '/api/items',
            schema: { query: apiQuerySchema },
            options: { decode: false },
          },
          (req, res) => {
            const validated = req.validated?.();
            const search = validated?.query?.search;
            const year = validated?.query?.year;
            const includeArchived = validated?.query?.includeArchived;

            res.json({
              original: req.query,
              data: {
                search,
                year,
                includeArchived,
              },
            });
          }
        )
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2005, includeArchived: true })
      .set('Accept', 'application/json')
      .expect(400);
    expect(response.body).to.have.property('errors');
    expect(response.body.errors).to.be.an('array');
    expect(response.body.errors).to.deep.equal([
      {
        keyword: 'type',
        schemaPath: '#/properties/query/properties/year',
        instancePath: '/query/year',
        params: { type: 'integer' },
        message: 'must be integer',
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
      year: Type.Optional(Type.Integer()),
      includeArchived: Type.Optional(Type.Boolean()),
    });

    const router = routing()
      .setValidators(routeValidatorTypebox())
      .get(
        ...route(
          {
            path: '/api/items',
            schema: { query: apiQuerySchema },
            options: options,
          },
          (req, res) => {
            const validated = req.validated?.();
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
        )
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2005, includeArchived: true })
      .set('Accept', 'application/json')
      .expect(200);
    // query parameters are always strings in the original request
    expect(response.body).to.have.property('original');
    expect(response.body.original).to.deep.equal({
      search: 'Get It How You Live',
      year: '2005',
      includeArchived: 'true',
    });
    // validated values should match the decoded query parameters
    expect(response.body).to.have.property('data');
    expect(response.body.data).to.deep.equal({ search: 'Get It How You Live', year: 2005, includeArchived: true });
  });

  /**
   * Should be able to decode query parameters using Codec definitions instead of relying on default parsing.
   */
  it('should have decoded query parameters', async () => {
    const apiQuerySchema = Type.Object({
      search: Type.String(),
      year: Type.Optional(
        Type.Codec(
          Type.Union([
            Type.Integer(),
            Type.String({ pattern: '^-?\\d+$' }), // allow numeric strings as well
          ])
        )
          .Decode((val) => {
            const parsed = typeof val === 'string' ? Number(val) : val;
            if (!Number.isSafeInteger(parsed)) {
              // mimic TypeBox validation error structure
              throw [
                {
                  keyword: 'type',
                  schemaPath: '#/properties/query/properties/year',
                  instancePath: '/query/year',
                  params: { type: 'integer' },
                  message: 'must be integer',
                },
              ];
            }
            return parsed; // Strictly typed and returned as `number`
          })
          .Encode((val) => val)
      ),
      includeArchived: Type.Optional(
        Type.Codec(Type.Union([Type.Boolean(), Type.Literal('true'), Type.Literal('false')]))
          .Decode((val) => val === true || val === 'true')
          .Encode((val) => val)
      ),
    });

    const router = routing()
      .setValidators(routeValidatorTypebox())
      .get(
        ...route(
          {
            path: '/api/items',
            schema: { query: apiQuerySchema },
            options: options,
          },
          (req, res) => {
            // using StaticDecode to get the decoded types of the query parameters
            const validated = req.validated?.();
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
        )
      );

    app.use(router);

    const response = await supertest(app)
      .get('/api/items')
      .query({ search: 'Get It How You Live', year: 2005, includeArchived: true })
      .set('Accept', 'application/json')
      .expect(200);
    // query parameters are always strings in the original request
    expect(response.body).to.have.property('original');
    expect(response.body.original).to.deep.equal({
      search: 'Get It How You Live',
      year: '2005',
      includeArchived: 'true',
    });
    // validated values should match the decoded query parameters
    expect(response.body).to.have.property('data');
    expect(response.body.data).to.deep.equal({ search: 'Get It How You Live', year: 2005, includeArchived: true });
  });
});
