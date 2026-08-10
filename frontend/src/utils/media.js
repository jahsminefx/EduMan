import { API_BASE_URL } from '../config/api';

export function mediaUrl(value) {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const path = String(value).startsWith('/') ? value : `/${value}`;
  return `${API_BASE_URL}${path}`;
}
