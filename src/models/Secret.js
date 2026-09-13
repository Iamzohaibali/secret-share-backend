import mongoose from "mongoose";

const secretSchema = new mongoose.Schema(
  {
    // Clerk user id of the creator
    owner: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    // AES-256-GCM encrypted payload, never store plain text
    encryptedContent: {
      type: String,
      required: true,
    },
    iv: {
      type: String,
      required: true,
    },
    authTag: {
      type: String,
      required: true,
    },

    // Public, unguessable identifier used in share links
    shareId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Optional password protection
    isPasswordProtected: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      default: null,
    },

    // Burn after read: the secret is destroyed the first time it is viewed
    burnAfterRead: {
      type: Boolean,
      default: false,
    },

    // View based expiry
    maxViews: {
      type: Number,
      default: null, // null = unlimited (until time expiry / burn)
    },
    viewCount: {
      type: Number,
      default: 0,
    },

    // Time based expiry
    expiresAt: {
      type: Date,
      default: null, // null = never expires by time
    },

    // Secret "type" gives the UI something to render differently
    secretType: {
      type: String,
      enum: ["text", "password", "apiKey", "note", "other"],
      default: "text",
    },

    tags: {
      type: [String],
      default: [],
    },

    isRevealed: {
      type: Boolean,
      default: false,
    },
    isBurned: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

secretSchema.index({ owner: 1, isDeleted: 1 });

secretSchema.methods.isExpiredByTime = function () {
  return this.expiresAt ? new Date() > this.expiresAt : false;
};

secretSchema.methods.isExpiredByViews = function () {
  return this.maxViews != null ? this.viewCount >= this.maxViews : false;
};

secretSchema.methods.isExpired = function () {
  return (
    this.isBurned ||
    this.isDeleted ||
    this.isExpiredByTime() ||
    this.isExpiredByViews()
  );
};

export default mongoose.model("Secret", secretSchema);