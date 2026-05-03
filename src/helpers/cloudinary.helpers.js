const cloudinary = require("../config/cloudinary");

const deleteCloudinaryFile = async (filename) => {
  if (!filename) return;

  try {
    await cloudinary.uploader.destroy(filename);
  } catch (error) {
    console.error(`Failed to delete Cloudinary file ${filename}:`, error.message);
    // Don't throw - we still want the main error to be reported
  }
};

module.exports = { deleteCloudinaryFile };
