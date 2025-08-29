import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage-wrapper";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days for better user experience
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    } catch (error) {
      console.error("Verification error:", error);
      verified(error);
    }
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    try {
      const strategyName = `replitauth:${req.hostname}`;

      // Check if strategy exists before attempting to authenticate
      if (!passport._strategy(strategyName)) {
        console.error(`Strategy ${strategyName} not found. Available strategies:`, Object.keys(passport._strategies || {}));
        return res.status(500).send(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Authentication Error - The Sandwich Project</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  margin: 0;
                  padding: 0;
                  min-height: 100vh;
                  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .container {
                  max-width: 480px;
                  padding: 2rem;
                  background: white;
                  border-radius: 1.5rem;
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                  border: 1px solid rgba(226, 232, 240, 0.8);
                  text-align: center;
                }
                .error-icon {
                  width: 48px;
                  height: 48px;
                  background: #fee2e2;
                  border-radius: 12px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 1.5rem;
                }
                h2 {
                  color: #1e293b;
                  font-size: 1.875rem;
                  font-weight: 700;
                  margin: 0 0 1rem;
                }
                p {
                  color: #64748b;
                  font-size: 1rem;
                  line-height: 1.6;
                  margin: 0 0 2rem;
                }
                .btn {
                  display: inline-block;
                  padding: 0.75rem 2rem;
                  background: #236383;
                  color: white;
                  text-decoration: none;
                  border-radius: 12px;
                  font-weight: 600;
                  transition: all 0.2s ease;
                  font-size: 1rem;
                }
                .btn:hover {
                  background: #1e5a75;
                  transform: translateY(-1px);
                  box-shadow: 0 10px 25px -5px rgba(35, 99, 131, 0.4);
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error-icon">
                  <svg width="24" height="24" fill="#dc2626" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                  </svg>
                </div>
                <h2>Authentication Error</h2>
                <p>Authentication system is not properly configured. Please contact an administrator for assistance.</p>
                <a href="/" class="btn">Return to Home Page</a>
              </div>
            </body>
          </html>
        `);
      }

      passport.authenticate(strategyName, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Failed - The Sandwich Project</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                min-height: 100vh;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                max-width: 480px;
                padding: 2rem;
                background: white;
                border-radius: 1.5rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                border: 1px solid rgba(226, 232, 240, 0.8);
                text-align: center;
              }
              .error-icon {
                width: 48px;
                height: 48px;
                background: #fee2e2;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.5rem;
              }
              h2 {
                color: #1e293b;
                font-size: 1.875rem;
                font-weight: 700;
                margin: 0 0 1rem;
              }
              p {
                color: #64748b;
                font-size: 1rem;
                line-height: 1.6;
                margin: 0 0 2rem;
              }
              .btn {
                display: inline-block;
                padding: 0.75rem 2rem;
                background: #236383;
                color: white;
                text-decoration: none;
                border-radius: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
                font-size: 1rem;
                margin-right: 1rem;
              }
              .btn:hover {
                background: #1e5a75;
                transform: translateY(-1px);
                box-shadow: 0 10px 25px -5px rgba(35, 99, 131, 0.4);
              }
              .btn-outline {
                background: transparent;
                color: #236383;
                border: 2px solid #236383;
              }
              .btn-outline:hover {
                background: #236383;
                color: white;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">
                <svg width="24" height="24" fill="#dc2626" viewBox="0 0 24 24">
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h2>Login Failed</h2>
              <p>An error occurred during login. Please try again or contact support if the problem persists.</p>
              <div>
                <a href="/api/login" class="btn">Try Again</a>
                <a href="/" class="btn btn-outline">Return Home</a>
              </div>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, (err, user, info) => {
      if (err) {
        console.error("Authentication callback error:", err);
        return res.redirect("/api/login");
      }
      if (!user) {
        console.error("No user returned from authentication:", info);
        return res.redirect("/api/login");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.redirect("/api/login");
        }
        console.log("Authentication successful, redirecting to /");
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user as any;
    // Check if user exists and has valid session
    if (!user || !user.expires_at) {
      return res.status(401).json({ message: "Unauthorized" });
    }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]): RequestHandler => {
  return async (req, res, next) => {
    const user = req.user as any;

    if (!req.isAuthenticated() || !user.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const dbUser = await storage.getUser(user.claims.sub);
      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ message: "User account not found or inactive" });
      }

      if (!allowedRoles.includes(dbUser.role)) {
        return res.status(403).json({ 
          message: "Insufficient permissions",
          required: allowedRoles,
          current: dbUser.role 
        });
      }

      // Attach user info to request for use in handlers
      (req as any).currentUser = dbUser;
      next();
    } catch (error) {
      res.status(500).json({ message: "Error checking user permissions" });
    }
  };
};

