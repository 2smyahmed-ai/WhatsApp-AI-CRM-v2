import { redirect } from 'next/navigation';

// The customer AI bot is now controlled from a single dedicated page.
export default function AiConfigRedirect() {
  redirect('/admin/customer-ai');
}
