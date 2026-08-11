import cloudinary from "../../lib/cloudinary";
import { AppError } from "../../utils/appError";

export const uploadImageToCloudinary = (
  file: Express.Multer.File,
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "tripverse" },
      (error, result) => {
        if (error || !result) {
          reject(new AppError(400, "Image upload failed. Please try again."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    uploadStream.end(file.buffer);
  });
};