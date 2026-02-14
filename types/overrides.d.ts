import routing from "@novice1/routing";

declare global {
  namespace Express {
    interface Request {

      validated?<Q = Record<string, unknown>, P = unknown, B = unknown, H = unknown, C = unknown, F = unknown>(): {
        query?: Q
        params?: P
        body?: B
        headers?: H
        cookies?: C
        files?: F
        [x: string]: unknown
      }
    }
  }

  namespace NoviceRouting {
    interface MetaParameters {
      onerror?: routing.ErrorRequestHandler
      validatorTypeboxOptions?: {
        parse?: boolean
      }
    }
  }
}

export { }