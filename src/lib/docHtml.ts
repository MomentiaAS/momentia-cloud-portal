import DOMPurify from 'dompurify';

const STORAGE_BUCKET = 'customer-doc-media';

/** Escape plain text and wrap as HTML paragraphs (legacy sections saved as plain text). */
export function normalizeBodyForEditor(raw: string): string {
  const t = raw?.trim() ?? '';
  if (!t) return '<p></p>';
  if (t.startsWith('<')) return t;

  const escaped = t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const parts = escaped.split(/\n\n+/);
  return parts.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

/** Safe subset for rendering stored editor HTML. */
export function sanitizeCustomerDocHtml(html: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  const allowedImgPrefix = `${base}/storage/v1/object/public/${STORAGE_BUCKET}/`;

  const restrictAttrs = (node: Element, data: { attrName: string; attrValue: string; keepAttr?: boolean }) => {
    if (data.attrName === 'src' && node.nodeName === 'IMG') {
      const v = data.attrValue?.trim() ?? '';
      if (!v.startsWith(allowedImgPrefix)) data.keepAttr = false;
    }
    if (data.attrName === 'href' && node.nodeName === 'A') {
      const v = data.attrValue?.trim() ?? '';
      if (!/^https?:\/\//i.test(v)) data.keepAttr = false;
    }
  };

  DOMPurify.addHook('uponSanitizeAttribute', restrictAttrs);
  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'base'],
    });
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', restrictAttrs);
  }
}
