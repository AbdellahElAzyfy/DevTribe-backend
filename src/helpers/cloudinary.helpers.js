const cloudinary = require("../config/cloudinary");
const fs = require("fs");

const deleteFile = async (file) => {
  if (!file) return;

  try {
    // If it's a local file (path is an absolute system path)
    if (file.path && !file.path.startsWith("http")) {
      if (fs.existsSync(file.path)) {
        fs.promises.unlink(file.path).catch(() => {});
      }
    } else if (file.filename) {
      // Cloudinary file
      await cloudinary.uploader.destroy(file.filename);
    }
  } catch (error) {
    console.error(`Failed to delete file:`, error.message);
  }
};

module.exports = { deleteFile, deleteCloudinaryFile: (filename) => deleteFile({ filename }) };
