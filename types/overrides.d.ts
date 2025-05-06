import routing from "@novice1/routing";
import { TSchema } from '@sinclair/typebox';

declare global {
  namespace NoviceRouting {
    interface MetaParameters {
        onerror?: routing.ErrorRequestHandler,
        validatorTypeboxOptions?: { references?: TSchema[] }
    }
  }
}

export {}