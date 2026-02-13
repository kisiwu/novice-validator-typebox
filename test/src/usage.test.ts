import { validatorTypebox } from '../../src/index';
import routing from '@novice1/routing';
import Logger from '@novice1/logger';
import { expect } from 'chai';

const onerror: routing.ErrorRequestHandler<unknown, { error: unknown }> = (err, _req, res) => {
  res.status(400).json({ error: err })
}

describe('Set validator', () => {

  const router = routing()
    .setValidators(validatorTypebox())
    .post({
      path: '/post',
      name: 'Post',
      description: 'Post a comment',
      tags: 'Comments',
      parameters: {
        onerror,
        validatorJsonOptions: { logger: Logger }
      }
    }, function postToDo(req, res) {
      res.json(req.meta)
    });

  it('should have registered \'post\' route with the validator middleware', function () {
    expect(router.stack[0].route?.path).to.equal('/post');

    let type: string = ''
    const layer: unknown = router.stack[0].route?.stack[1]
    if (layer && typeof layer === 'object' && 'type' in layer && typeof layer.type === 'string') {
      type = layer.type
    }

    expect(type)
      .to.eql('validator');

    expect(router.stack[0].route?.stack[1].name)
      .to.eql('validatorTypeboxRequestHandler');
  });
});
