import { supabase } from './supabase';

const BUCKET = 'avatars';

function sanitizeExt(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadAvatarForUser(args: {
  userId: string;
  file: File;
}): Promise<{ publicUrl: string; path: string }> {
  const { userId, file } = args;
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Image is too large. Max 5 MB.');
  }

  const ext = sanitizeExt(file.type);
  const path = `${userId}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    });
  if (upErr) throw new Error(upErr.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  return { publicUrl, path };
}

export async function removeAvatarForUser(userId: string): Promise<void> {
  // Remove all matching avatar.* objects for this user. We don't list objects
  // (needs extra permissions), so we attempt common extensions.
  const candidates = ['jpg', 'png', 'webp'].map(ext => `${userId}/avatar.${ext}`);
  const { error } = await supabase.storage.from(BUCKET).remove(candidates);
  if (error) throw new Error(error.message);
}

