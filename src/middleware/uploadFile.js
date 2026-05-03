const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const createUploadMiddleware = (folder, fieldName = "image") => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      resource_type: "auto",
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  }).single(fieldName);
};

const uploadFile = createUploadMiddleware("devtribe/posts", "image");
const uploadAvatar = createUploadMiddleware("devtribe/users", "avatar");

module.exports = { uploadFile, uploadAvatar, createUploadMiddleware };
