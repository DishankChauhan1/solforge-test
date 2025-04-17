import * as admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

// Interface to extend Express Request with user property
export interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

/**
 * Express middleware that validates Firebase ID Tokens passed in the Authorization header.
 * 
 * If the token is valid, it adds the decoded user information to the request object.
 * 
 * @param req The Express Request object
 * @param res The Express Response object
 * @param next The Express Next function
 */
export const validateFirebaseIdToken = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => {
  console.log('Validating Firebase ID token');
  
  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !(req.cookies && req.cookies.__session)) {
    console.error('No Firebase ID token was passed');
    return res.status(403).json({ error: 'Unauthorized' });
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    console.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    console.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No token found
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    console.log('ID Token correctly decoded', decodedIdToken);
    req.user = decodedIdToken;
    return next();
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    return res.status(403).json({ error: 'Unauthorized' });
  }
}; 