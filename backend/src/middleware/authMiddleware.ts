import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface TokenPayload extends JwtPayload {
  userId: number;
}

export interface AuthRequest extends Request {
  userId?: number;
  user?: {
    userId: number;
  };
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: {
        userId: number;
      };
    }
  }
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!authHeaderStr || !authHeaderStr.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access token required" });
  }

  const token = authHeaderStr.split(" ")[1]?.trim();

  if (!token) {
    return res.status(401).json({ message: "Malformed access token" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not defined in environment variables");
    return res.status(500).json({ message: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;

    if (!decoded || typeof decoded.userId !== "number") {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.userId = decoded.userId;
    req.user = { userId: decoded.userId };

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token has expired" });
    }
    return res.status(401).json({ message: "Invalid or malformed token" });
  }
};

export const authMiddleware = authenticateToken;
export default authenticateToken;
