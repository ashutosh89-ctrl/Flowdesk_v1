import { redirect } from 'next/navigation';

/**
 * Backwards-compatible route for old client-login links.
 * FlowDesk now uses one shared authentication entry point. The post-login
 * gate automatically routes authenticated users to the workspace they own.
 */
export default function ClientLoginRedirect() {
  redirect('/login');
}
