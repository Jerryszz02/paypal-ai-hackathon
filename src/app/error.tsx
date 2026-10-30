'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h1>This page could not be loaded.</h1>
      <p>Your saved claims are unchanged. Try loading the page again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
