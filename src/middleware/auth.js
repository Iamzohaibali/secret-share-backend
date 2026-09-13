import { getAuth } from "@clerk/express";

// Use after app.use(clerkMiddleware()) in server.js.
// Blocks the request unless Clerk recognizes a signed-in user.
export const requireAuthUser = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Please sign in to continue.",
    });
  }
  req.userId = userId;
  next();
};