# Task 9 Report: Attachment Module

## Status: Complete

## What was done

Created the Attachment module for file upload/download/delete with sync logging.

### Files created
- `server/src/attachments/attachment.service.ts` — AttachmentService with:
  - `upload(userId, file, businessCode, businessId)`: creates AttachmentEntity record via per-user repository (ConnectionManager), writes file buffer to disk at `{dataPath}/{userId}/attachments/{id}.{ext}`, and records a LogSync entry (BusinessType.ATTACHMENT / OperateType.CREATE / SyncState.UNSYNCED).
  - `findByBusiness(userId, businessCode, businessId)`: lists attachments for a business entity.
  - `getFilePath(userId, id)`: resolves on-disk path; throws NotFoundException (404) if attachment row or file missing.
  - `remove(userId, id)`: deletes DB row + disk file, logs LogSync DELETE entry. Idempotent (returns `{ deleted: true }` even if row absent).
- `server/src/attachments/attachment.controller.ts` — routes under `attachments`:
  - `POST /attachments/upload` — multipart via `FileInterceptor('file')`, fields `businessCode`, `businessId`
  - `GET /attachments?businessCode=&businessId=` — list by business
  - `GET /attachments/:id` — streams file with Content-Type from stored mimeType and RFC 5987 UTF-8 Content-Disposition filename
  - `DELETE /attachments/:id` — remove
- `server/src/attachments/attachment.module.ts` — standard NestJS module.

### Files modified
- `server/src/app.module.ts` — added `AttachmentModule` to imports.

## Verification
- `cd server && npx nest build` — compiled with no errors.
- `@nestjs/platform-express` confirmed present in `server/package.json` (FileInterceptor dependency). Multer types available through it (`Express.Multer.File`).
- Committed: `feat: attachment module - upload/download/delete with sync`.

## Notes
- Followed existing patterns from item.service/item.controller (per-user repos, LogSync with parentType 'book' / parentId 'None' for attachments, `as any` casts consistent with codebase style).
- Storage layout: `{dataPath (default ./data)}/{userId}/attachments/{attachmentId}.{extension}`.
- Auth handled by global JwtAuthGuard (APP_GUARD), matching other modules — no per-controller guard needed.
