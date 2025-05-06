export { };

declare global {
  namespace Express {
    interface Request {
      // add a property
      files?: unknown;
    }
  }
}