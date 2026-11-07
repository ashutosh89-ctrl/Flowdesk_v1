import { permanentRedirect } from 'next/navigation';

export default function SecurityPage() {
  permanentRedirect('/privacy');
}
