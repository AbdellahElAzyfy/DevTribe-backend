const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const path = require("path");

const createUploadMiddleware = (folder, fieldName = "image") => {
  let storage;

  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder,
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        resource_type: "auto",
      },
    });
  } else {
    // Fallback to local storage
    const uploadPath = path.join(__dirname, "../../public/uploads", folder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
      },
    });
  }

  return multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"), false);
      }
    }
  }).single(fieldName);
};

const uploadFile = createUploadMiddleware("devtribe/posts", "image");
const uploadAvatar = createUploadMiddleware("devtribe/users", "avatar");

module.exports = { uploadFile, uploadAvatar, createUploadMiddleware };
