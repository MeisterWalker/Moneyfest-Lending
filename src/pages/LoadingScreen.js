import { useEffect, useState } from 'react'

export default function LoadingScreen({ onComplete }) {
  const [phase, setPhase] = useState('spin') // spin → pulse → fadeout
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Progress bar fills up
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 2
      })
    }, 30)

    // Phase transitions
    const pulseTimer = setTimeout(() => setPhase('pulse'), 1200)
    const fadeTimer = setTimeout(() => setPhase('fadeout'), 1800)
    const doneTimer = setTimeout(() => onComplete && onComplete(), 2100)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(pulseTimer)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onComplete])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      opacity: phase === 'fadeout' ? 0 : 1,
      transition: 'opacity 0.4s ease',
      gap: 32
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Peso coin animation */}
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        {/* Outer ring - spinning */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: 'var(--blue)',
          borderRightColor: 'rgba(59,130,246,0.3)',
          animation: phase === 'spin' ? 'pesoSpin 0.8s linear infinite' : 'none',
          transition: 'all 0.3s ease'
        }} />

        {/* Middle ring */}
        <div style={{
          position: 'absolute',
          inset: 8,
          borderRadius: '50%',
          border: '1px solid rgba(139,92,246,0.3)',
          borderBottomColor: 'var(--purple)',
          animation: phase === 'spin' ? 'pesoSpinReverse 1.2s linear infinite' : 'none',
        }} />

        {/* Coin face */}
        <div style={{
          position: 'absolute',
          inset: 16,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: phase === 'pulse' ? 'pesoPulse 0.3s ease-out' : 'none',
          boxShadow: phase === 'pulse' ? '0 0 40px rgba(59,130,246,0.4)' : '0 0 20px rgba(59,130,246,0.2)',
          transition: 'box-shadow 0.3s ease'
        }}>
          <img
            src="/favicon-96x96.png"
            alt="LoanMoneyfest"
            style={{
              width: 52,
              height: 52,
              objectFit: 'contain',
              animation: phase === 'spin' ? 'pesoBounce 1.6s ease-in-out infinite' : 'none'
            }}
          />
        </div>
      </div>

      {/* App name */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #F0F4FF 30%, #93C5FD 70%, #C4B5FD 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 6
        }}>
          LoanMoneyfest
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase'
        }}>
          {phase === 'pulse' ? 'Ready' : 'Loading...'}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: 200,
        height: 2,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 2,
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--blue), var(--purple))',
          borderRadius: 2,
          transition: 'width 0.03s linear',
          boxShadow: '0 0 8px rgba(59,130,246,0.6)'
        }} />
      </div>

      <style>{`
        @keyframes pesoSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pesoSpinReverse {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes pesoBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes pesoPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
