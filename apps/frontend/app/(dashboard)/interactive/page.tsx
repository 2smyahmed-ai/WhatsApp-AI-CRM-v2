import { redirect } from 'next/navigation';

// Interactive messages are now part of Templates — one place to design and
// send everything (text, media, tappable buttons). Old links land there.
export default function InteractiveRedirect() {
  redirect('/templates');
}
