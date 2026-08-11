# Step 5 — Uploads Module

## Endpoint — `/api/uploads`
```
POST   /image                auth(AGENT, ADMIN)   multipart, single field "image", max 5MB, jpg/png/webp only
```

- Backed by Cloudinary (`cloudinary` npm SDK) — signed upload preferred so the upload preset isn't exposed client-side.
- Request goes: client → this endpoint (`multer`, memory storage) → Cloudinary `upload_stream` → returns `{ url, publicId }`.
- Frontend calls this per-image before submitting the package form, then sends the resulting URLs in the package create/edit payload (Step 8) — package endpoints never touch file bytes.
- Validation: multer `fileFilter` restricts to jpg/png/webp, `limits.fileSize` caps at 5MB, before the file ever reaches Cloudinary.
- Max 6 URLs accepted per package at the validation layer (Zod `.max(6)` on the `images` array in package create/edit schemas — enforced in Step 8, not here).
- **[LATER]** `DELETE /uploads/:publicId` — remove from Cloudinary when a package/image is deleted; MVP just leaves orphaned Cloudinary assets (cheap to clean up manually later, not worth building now).
