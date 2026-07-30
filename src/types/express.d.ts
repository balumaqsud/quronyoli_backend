import { AuthRequestContext } from '../../modules/auth/interfaces/auth-request-context.interface';

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthRequestContext;
      cookies: Record<string, string | undefined>;
    }
  }
}

export {};
