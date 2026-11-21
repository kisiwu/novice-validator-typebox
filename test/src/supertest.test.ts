import { validatorTypebox } from '../../src/index.js';
import routing from '@novice1/routing';
import { expect } from 'chai';
import express from 'express';
import supertest from 'supertest';
import Type from 'typebox';

const onerror: routing.ErrorRequestHandler<unknown, { error: unknown; isCustom: boolean }> = (err, _req, res) => {
  res.status(400).json({ error: err, isCustom: true });
};

describe('Set validator', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should return the posted comment and rating', async () => {
    const router = routing()
      .setValidators(
        validatorTypebox(
          {},
          undefined, // error handler
          'schema'
        )
      )
      .post(
        {
          path: '/post',
          name: 'Post',
          description: 'Post a comment',
          tags: 'Comments',
          parameters: {
            schema: {
              body: Type.Object({
                comment: Type.String(),
                rating: Type.Number(),
              }),
            },
            onerror,
          },
        },
        function postToDo(req, res) {
          res.json(req.body);
        }
      );

    app.use(router);

    const response = await supertest(app)
      .post('/post')
      .send({ comment: 'Great post!', rating: 5 })
      .set('Accept', 'application/json')
      .expect(200);
    expect(response.body).to.have.property('comment');
    expect(response.body).to.have.property('rating');
  });

  it('should return 400 for invalid body', async () => {
    const router = routing()
      .setValidators(validatorTypebox({}, undefined, 'schema'))
      .post(
        {
          path: '/post',
          name: 'Post',
          description: 'Post a comment',
          tags: 'Comments',
          parameters: {
            schema: {
              body: Type.Object({
                comment: Type.String(),
                rating: Type.Number(),
              }),
            },
            onerror,
          },
        },
        function postToDo(req, res) {
          res.json(req.body);
        }
      );

    app.use(router);

    const response = await supertest(app)
      .post('/post')
      .send({ comment: 'Great post!' }) // missing rating
      .set('Accept', 'application/json')
      .expect(400);
    expect(response.body).to.have.property('isCustom').that.is.true;
    expect(response.body).to.have.property('error');
    expect(response.body.isCustom).to.be.true;
    expect(response.body.error).to.have.property('errors');
    expect(response.body.error.errors).to.be.an('array').that.is.not.empty;
  });

  it('should return 400 for missing body with default error handler', async () => {
    const router = routing()
      .setValidators(
        validatorTypebox(
          {},
          (err, _req, res, _next) => res.status(400).json(err), // error handler
          'schema'
        )
      )
      .post(
        {
          path: '/post',
          name: 'Post',
          description: 'Post a comment',
          tags: 'Comments',
          parameters: {
            schema: {
              body: Type.Object({
                comment: Type.String(),
                rating: Type.Number(),
              }),
            },
          },
        },
        function postToDo(req, res) {
          res.json(req.body);
        }
      );

    app.use(router);

    const response = await supertest(app)
      .post('/post')
      .send({}) // missing body
      .set('Accept', 'application/json')
      .expect(400);
    expect(response.body).to.have.not.property('isCustom');
    expect(response.body).to.have.property('errors');
    expect(response.body.errors).to.be.an('array').that.is.not.empty;
  });

  it('should have validated() in the request object with parsed values', async () => {
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
      // options: parse = true to parse and validate the request automatically
      .setValidators(validatorTypebox({ parse: true }, undefined, 'schema'))
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

  it('should have validated() in the request object without parsing the values', async () => {
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
      // options: parse = false to not parse the validated values in the request
      .setValidators(validatorTypebox({ parse: false }, undefined, 'schema'))
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
      .query({ bool: false, number: 6 })
      .set('Accept', 'application/json')
      .expect(200);
    // query parameters are always strings in the original request
    expect(response.body).to.have.property('original');
    expect(response.body.original).to.deep.equal({ bool: 'false', number: '6' });
    // validated values should match the parsed query parameters
    expect(response.body).to.have.property('validated');
    expect(response.body.validated).to.deep.equal({ bool: 'false', number: '6' });
  });
});
