import routing from "@novice1/routing";

declare global {
  namespace NoviceRouting {
    interface MetaParameters {
        onerror?: routing.ErrorRequestHandler
    }
  }
}

export {}