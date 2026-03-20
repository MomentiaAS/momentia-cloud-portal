import { supabase } from './supabase';

const BUCKET = 'customer-doc-media';

const ACCEPT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

function safeExt(file: File): string {
  const fromName = file.name.split('.').pop() ?? '';
  const clean = fromName.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8);
  if (clean === 'jpg') return 'jpeg';
  return ['png', 'jpeg', 'gif', 'webp'].includes(clean) ? clean : 'png';
}

/** Upload pasted / chosen image; returns public URL for embedding in doc HTML. */
export async function uploadCustomerDocImage(
  customerId: string,
  sectionId: string,
  file: File,
): Promise<string> {
  if (!file.type || !ACCEPT_TYPES.has(file.type)) {
    throw new Error('Only PNG, JPEG, GIF, or WebP images are allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  const ext = safeExt(file);
  const path = `${customerId}/${sectionId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
