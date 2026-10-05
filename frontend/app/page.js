'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_LENGTH = 12000;
const SAMPLE = 'Our product team met on Monday to plan the next release. We agreed to launch the updated customer dashboard on November 15, after two weeks of usability testing. Priya will coordinate testing and Alex will update the onboarding guide. The team will review feedback next Friday before finalizing the launch checklist.';

async function request(path, options = {}) {
  let response;
  try { response = await fetch(`/api${path}`, { ...options, cache: 'no-store' }); }
  catch { throw new Error('Could not reach the server. Check your connection and try again.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'The server is unavailable. Please try again.');
  if (!data) throw new Error('The server returned an unexpected response.');
  return data;
}

function Tags({ tags }) {
  return <div className="tags">{tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>;
}

function dateLabel(value) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Home() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const listRequest = useRef(0);
  const resultRef = useRef(null);

  async function loadEntries() {
    const current = ++listRequest.current;
    setLoading(true);
    setListError('');
    try {
      const data = await request('/entries');
      if (current !== listRequest.current) return;
      setEntries(data);
      setSelected(previous => previous ? data.find(entry => entry.id === previous.id) ?? data[0] ?? null : data[0] ?? null);
    } catch (error) {
      if (current === listRequest.current) setListError(error.message);
    } finally {
      if (current === listRequest.current) setLoading(false);
    }
  }

  useEffect(() => { loadEntries(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    setNotice('');
    if (!text.trim()) { setError('Enter some text to summarize.'); return; }
    if (text.length > MAX_LENGTH) { setError('Keep your text under 12,000 characters.'); return; }
    pending.current = true;
    setSubmitting(true);
    try {
      const entry = await request('/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      });
      // Invalidate any older list fetch so it cannot overwrite the new entry.
      ++listRequest.current;
      setLoading(false);
      setEntries(previous => [entry, ...previous.filter(item => item.id !== entry.id)]);
      setSelected(entry);
      setListError('');
      setNotice('Summary generated and saved.');
      setText('');
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (error) { setError(error.message); }
    finally { pending.current = false; setSubmitting(false); }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Briefly home"><span className="brand-icon" aria-hidden="true">b.</span>briefly<span className="brand-dot">.</span></a>
        <span className="topbar-label">AI CONTENT ASSISTANT</span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow"><span /> LESS READING. MORE CLARITY.</p>
          <h1>Your words, <span>in focus.</span></h1>
          <p className="intro-copy">Turn notes, articles, and meeting transcripts into a clear summary<br className="desktop-break" /> and three useful tags. Save the essentials for later.</p>
        </section>

        <div className="workspace">
          <section className="card composer" aria-labelledby="compose-heading">
            <div className="card-heading"><div><p className="section-number">01 / CREATE</p><h2 id="compose-heading">Start with your text</h2></div><span className="small-icon" aria-hidden="true">↗</span></div>
            <form onSubmit={submit}>
              <div className="input-heading"><label htmlFor="source-text">Your content</label><button type="button" className="text-button" disabled={submitting} onClick={() => { setText(SAMPLE); setError(''); setNotice(''); }}>Try an example</button></div>
              <textarea id="source-text" value={text} onChange={event => { setText(event.target.value); setError(''); setNotice(''); }} disabled={submitting} maxLength={MAX_LENGTH} placeholder="Paste your meeting notes, an article, or a thought you want to make sense of…" aria-describedby="input-help character-count" aria-invalid={Boolean(error)} />
              <div className="input-meta"><span id="input-help">A little context goes a long way.</span><span id="character-count">{text.length.toLocaleString()} / 12,000</span></div>
              {error && <p className="message error" role="alert">{error}</p>}
              <button className="primary-button" type="submit" disabled={submitting || loading || !text.trim()}>{submitting ? <><span className="spinner" /> Creating your summary…</> : <>Summarize & save <span aria-hidden="true">↗</span></>}</button>
              <p className="privacy-note">Your text is sent to Google Gemini for summarization.<br />Please leave out personal or confidential information.</p>
            </form>
          </section>

          <section className={`card result ${selected ? '' : 'result-empty'}`} aria-labelledby="result-heading" aria-busy={submitting}>
            <div className="card-heading"><div><p className="section-number">02 / THE ESSENTIALS</p><h2 id="result-heading" tabIndex={-1} ref={resultRef}>Your summary</h2></div>{selected && <span className="saved-badge">Saved</span>}</div>
            <p className="sr-only" role="status">{submitting ? 'Generating summary. Please wait.' : notice}</p>
            {submitting ? <div className="empty-content"><span className="large-mark pulse" aria-hidden="true">✧</span><h3>Finding the essentials</h3><p>Reading your content and bringing<br />the important details together.</p></div>
              : selected ? <div className="result-content"><p className="summary-text">{selected.summary}</p><p className="field-caption">THREE THINGS TO REMEMBER</p><Tags tags={selected.tags} /><div className="source-block"><p className="field-caption">ORIGINAL TEXT</p><p className="original-text">{selected.originalText}</p></div><p className="saved-date">Saved {dateLabel(selected.createdAt)}</p><p className="ai-note">AI-generated. Review important details against the original.</p></div>
              : <div className="empty-content"><span className="large-mark" aria-hidden="true">✧</span><h3>A clearer picture starts here</h3><p>Add some text and we’ll find the key ideas.<br />Your summary and tags will appear here.</p><div className="placeholder-tags" aria-hidden="true"><span>One summary</span><span>Three tags</span></div></div>}
          </section>
        </div>

        <section className="library" aria-labelledby="library-heading">
          <div className="library-heading"><div><p className="section-number">YOUR COLLECTION</p><h2 id="library-heading">Saved entries <span className="count">{entries.length}</span></h2></div><button className="text-button" onClick={loadEntries} disabled={loading || submitting}>{loading ? 'Loading…' : 'Refresh ↻'}</button></div>
          {listError && <p className="message error" role="alert">{listError} <button className="text-button" onClick={loadEntries}>Try again</button></p>}
          {loading ? <p className="library-empty" role="status">Loading saved entries…</p> : !entries.length ? <div className="library-empty"><span aria-hidden="true">▤</span><p>No entries yet. Your first summary is a good place to start.</p></div> : <div className="entry-grid">{entries.map(entry => <button key={entry.id} className={`entry-card ${selected?.id === entry.id ? 'selected' : ''}`} aria-pressed={selected?.id === entry.id} disabled={submitting} onClick={() => { setSelected(entry); resultRef.current?.focus(); }}><div className="entry-top"><span>{dateLabel(entry.createdAt)}</span><span aria-hidden="true">↗</span></div><p>{entry.summary}</p><Tags tags={entry.tags} /></button>)}</div>}
        </section>
      </main>
      <footer><span>briefly. <span className="footer-muted">A little less noise.</span></span><span>Summarize. Organize. Revisit.</span></footer>
    </div>
  );
}
