import { useState } from 'react'
import { Heart, Send } from 'lucide-react'
import { gameApiBase } from '../lib/api'
import './FeedbackDesk.css'

export function FeedbackDesk({ walletAddress }: { walletAddress?: string }) {
  const [score, setScore] = useState(5)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (message.trim().length < 4) {
      setError('Tell Kira a little more — at least four characters.')
      setState('error')
      return
    }
    setState('sending')
    setError('')
    try {
      const response = await fetch(gameApiBase + '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, score, message: message.trim() }),
      })
      if (!response.ok) throw new Error('The feedback relay is offline. Please try again.')
      setMessage('')
      setState('sent')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send feedback.')
      setState('error')
    }
  }

  return <section className="feedback-desk section-wrap" aria-labelledby="feedback-title">
    <div className="feedback-card comic-panel">
      <div className="feedback-copy">
        <span><Heart size={14} /> PILOT SIGNAL</span>
        <h2 id="feedback-title">Tell Kira how<br /><i>the flight felt.</i></h2>
        <p>Your note lands in the private Ops dashboard so the next arena build can be sharper, fairer, and more fun.</p>
      </div>
      <form onSubmit={send}>
        <fieldset disabled={state === 'sending'}>
          <legend>Rate this build</legend>
          <div className="feedback-stars" aria-label="Rating from one to five">
            {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" onClick={() => { setScore(value); setState('idle') }} aria-label={value + ' stars'} aria-pressed={score === value} className={value <= score ? 'active' : ''}>★</button>)}
          </div>
        </fieldset>
        <label>YOUR TRANSMISSION
          <textarea value={message} onChange={event => { setMessage(event.target.value); setState('idle') }} maxLength={2000} placeholder="What should Kira improve next?" />
        </label>
        {state === 'sent' && <p className="feedback-success">Signal received. Thank you, pilot ✦</p>}
        {state === 'error' && <p className="feedback-error">{error}</p>}
        <button className="feedback-submit" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : <>Send to Kira <Send size={14} /></>}</button>
      </form>
    </div>
  </section>
}
