const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "devtribe/posts",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    resource_type: "auto",
  },
});

const uploadFile = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadFile;
