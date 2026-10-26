'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="error-page"><h1>Something interrupted this view.</h1><p>Please try opening it again. Download your review regularly to keep a copy.</p><button onClick={reset}>Try again</button></main>;}
