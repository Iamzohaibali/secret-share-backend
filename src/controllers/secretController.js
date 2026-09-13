import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import Secret from "../models/Secret.js";
import { encryptText, decryptText } from "../utils/encryption.js";

const MAX_SECRETS_PER_USER = Number(process.env.MAX_SECRETS_PER_USER || 100);

const publicShape = (secret) => ({
  id: secret._id,
  title: secret.title,
  shareId: secret.shareId,
  secretType: secret.secretType,
  tags: secret.tags,
  isPasswordProtected: secret.isPasswordProtected,
  burnAfterRead: secret.burnAfterRead,
  maxViews: secret.maxViews,
  viewCount: secret.viewCount,
  expiresAt: secret.expiresAt,
  isBurned: secret.isBurned,
  isExpired: secret.isExpired(),
  createdAt: secret.createdAt,
});

// POST /api/secrets
export const createSecret = async (req, res, next) => {
  try {
    const {
      title,
      content,
      secretType = "text",
      tags = [],
      burnAfterRead = false,
      maxViews,
      password,
      expiresAt, // ISO date string chosen directly by the user
      expiresInHours, // OR a relative offset in hours
    } = req.body;

    if (!title || !content) {
      return res
        .status(400)
        .json({ success: false, message: "Title and content are required" });
    }

    const existingCount = await Secret.countDocuments({
      owner: req.userId,
      isDeleted: false,
    });
    if (existingCount >= MAX_SECRETS_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `You've reached the limit of ${MAX_SECRETS_PER_USER} secrets. Delete an old one to create a new one.`,
      });
    }

    let resolvedExpiresAt = null;
    if (expiresAt) {
      resolvedExpiresAt = new Date(expiresAt);
    } else if (expiresInHours) {
      resolvedExpiresAt = new Date(
        Date.now() + Number(expiresInHours) * 60 * 60 * 1000
      );
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const { content: encryptedContent, iv, authTag } = encryptText(content);

    const secret = await Secret.create({
      owner: req.userId,
      title,
      encryptedContent,
      iv,
      authTag,
      shareId: nanoid(12),
      secretType,
      tags,
      burnAfterRead,
      maxViews: burnAfterRead ? 1 : maxViews || null,
      isPasswordProtected: Boolean(password),
      passwordHash,
      expiresAt: resolvedExpiresAt,
    });

    res.status(201).json({ success: true, data: publicShape(secret) });
  } catch (error) {
    next(error);
  }
};

// GET /api/secrets  (secrets owned by the signed-in user)
export const getMySecrets = async (req, res, next) => {
  try {
    const secrets = await Secret.find({
      owner: req.userId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: secrets.length,
      limit: MAX_SECRETS_PER_USER,
      data: secrets.map(publicShape),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/secrets/:id  (owner only, includes decrypted content for their own view)
export const getSecretById = async (req, res, next) => {
  try {
    const secret = await Secret.findOne({
      _id: req.params.id,
      owner: req.userId,
      isDeleted: false,
    });
    if (!secret) {
      return res.status(404).json({ success: false, message: "Secret not found" });
    }
    res.json({ success: true, data: publicShape(secret) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/secrets/:id  (owner can update title/tags/expiry, not the content)
export const updateSecret = async (req, res, next) => {
  try {
    const { title, tags, expiresAt, maxViews } = req.body;
    const secret = await Secret.findOne({
      _id: req.params.id,
      owner: req.userId,
      isDeleted: false,
    });
    if (!secret) {
      return res.status(404).json({ success: false, message: "Secret not found" });
    }

    if (title !== undefined) secret.title = title;
    if (tags !== undefined) secret.tags = tags;
    if (expiresAt !== undefined) secret.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (maxViews !== undefined) secret.maxViews = maxViews;

    await secret.save();
    res.json({ success: true, data: publicShape(secret) });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/secrets/:id
export const deleteSecret = async (req, res, next) => {
  try {
    const secret = await Secret.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { isDeleted: true },
      { new: true }
    );
    if (!secret) {
      return res.status(404).json({ success: false, message: "Secret not found" });
    }
    res.json({ success: true, message: "Secret deleted" });
  } catch (error) {
    next(error);
  }
};

// GET /api/share/:shareId  (public, no auth â€” returns metadata only, never content)
export const getShareMeta = async (req, res, next) => {
  try {
    const secret = await Secret.findOne({ shareId: req.params.shareId });
    if (!secret || secret.isDeleted) {
      return res.status(404).json({ success: false, message: "This secret does not exist" });
    }
    if (secret.isExpired()) {
      return res.status(410).json({ success: false, message: "This secret has expired or was already viewed" });
    }
    res.json({
      success: true,
      data: {
        title: secret.title,
        secretType: secret.secretType,
        isPasswordProtected: secret.isPasswordProtected,
        burnAfterRead: secret.burnAfterRead,
        expiresAt: secret.expiresAt,
        maxViews: secret.maxViews,
        viewCount: secret.viewCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/share/:shareId/reveal  (public â€” reveals + decrements/burns as configured)
export const revealSecret = async (req, res, next) => {
  try {
    const { password } = req.body;
    const secret = await Secret.findOne({ shareId: req.params.shareId });

    if (!secret || secret.isDeleted) {
      return res.status(404).json({ success: false, message: "This secret does not exist" });
    }
    if (secret.isExpired()) {
      return res.status(410).json({ success: false, message: "This secret has expired or was already viewed" });
    }
    if (secret.isPasswordProtected) {
      const matches = password && (await bcrypt.compare(password, secret.passwordHash));
      if (!matches) {
        return res.status(401).json({ success: false, message: "Incorrect password" });
      }
    }

    const content = decryptText({
      content: secret.encryptedContent,
      iv: secret.iv,
      authTag: secret.authTag,
    });

    secret.viewCount += 1;
    secret.isRevealed = true;
    if (secret.burnAfterRead || secret.isExpiredByViews()) {
      secret.isBurned = true;
    }
    await secret.save();

    res.json({
      success: true,
      data: {
        title: secret.title,
        content,
        secretType: secret.secretType,
        wasBurned: secret.isBurned,
      },
    });
  } catch (error) {
    next(error);
  }
};