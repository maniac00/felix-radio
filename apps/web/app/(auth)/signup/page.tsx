import { redirect } from 'next/navigation';

export const runtime = 'edge';

export default function SignUpPage() {
  // Redirect to login page - we use Google OAuth only
  redirect('/login');
}
