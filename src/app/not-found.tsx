import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>This page could not be found.</h1>
      <p>The claim may have moved, or this link may be incomplete.</p>
      <Link className="button primary" href="/claims">
        Back to claims
      </Link>
    </div>
  );
}
