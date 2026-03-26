import { useState, useRef } from 'react'
import { Camera, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Generate a unique color pair from a name
function getAvatarColors(name = '') {
  const colors = [
    ['#3B82F6', '#8B5CF6'], // blue → purple
    ['#06B6D4', '#3B82F6'], // cyan → blue
    ['#8B5CF6', '#EC4899'], // purple → pink
    ['#14B8A6', '#3B82F6'], // teal → blue
    ['#F59E0B', '#EF4444'], // gold → red
    ['#22C55E', '#14B8A6'], // green → teal
    ['#EF4444', '#F59E0B'], // red → gold
    ['#6366F1', '#8B5CF6'], // indigo → purple
    ['#EC4899', '#F59E0B'], // pink → gold
    ['#0EA5E9', '#22C55E'], // sky → green
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

// Get initials from full name
function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// Cute SVG pattern background based on name hash
function getPattern(name = '') {
  const patterns = ['circles', 'dots', 'waves', 'grid', 'triangles']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return patterns[Math.abs(hash) % patterns.length]
}

function AvatarPattern({ pattern, color }) {
  const opacity = 0.15
  switch (pattern) {
    case 'circles':
      return (
        <>
          <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity} />
          <circle cx="38" cy="38" r="6" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity} />
          <circle cx="38" cy="8" r="4" fill="none" stroke={color} strokeWidth="1" opacity={opacity} />
          <circle cx="8" cy="38" r="4" fill="none" stroke={color} strokeWidth="1" opacity={opacity} />
          <circle cx="23" cy="23" r="10" fill="none" stroke={color} strokeWidth="1" opacity={opacity * 0.7} />
        </>
      )
    case 'dots':
      return (
        <>
          {[6, 14, 22, 30, 38].map(x =>
            [6, 14, 22, 30, 38].map(y => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill={color} opacity={opacity} />
            ))
          )}
        </>
      )
    case 'waves':
      return (
        <>
          <path d="M0 12 Q12 6 24 12 Q36 18 48 12" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity} />
          <path d="M0 22 Q12 16 24 22 Q36 28 48 22" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity} />
          <path d="M0 32 Q12 26 24 32 Q36 38 48 32" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity} />
        </>
      )
    case 'grid':
      return (
        <>
          {[8, 16, 24, 32, 40].map(v => (
            <g key={v}>
              <line x1={v} y1="0" x2={v} y2="46" stroke={color} strokeWidth="0.8" opacity={opacity} />
              <line x1="0" y1={v} x2="46" y2={v} stroke={color} strokeWidth="0.8" opacity={opacity} />
            </g>
          ))}
        </>
      )
    case 'triangles':
      return (
        <>
          <polygon points="23,4 35,24 11,24" fill="none" stroke={color} strokeWidth="1.2" opacity={opacity} />
          <polygon points="23,42 35,22 11,22" fill="none" stroke={color} strokeWidth="1.2" opacity={opacity} />
          <polygon points="4,23 24,11 24,35" fill="none" stroke={color} strokeWidth="1" opacity={opacity * 0.6} />
        </>
      )
    default: return null
  }
}

// The main avatar display component
export function BorrowerAvatar({ name = '', photoUrl = null, size = 46, editable = false, onPhotoChange }) {
  const [hover, setHover] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()
  const [colors] = useState(() => getAvatarColors(name))
  const pattern = getPattern(name)
  const initials = getInitials(name)
  const borderRadius = size > 40 ? 12 : 8

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `avatars/${Date.now()}_${name.replace(/\s/g, '_')}.${ext}`

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('borrower-avatars')
      .upload(fileName, file, { upsert: true })

    if (error) {
      console.error('Storage upload error:', error)
      // Fallback: use local object URL if storage not set up (will disappear on refresh)
      const localUrl = URL.createObjectURL(file)
      onPhotoChange && onPhotoChange(localUrl)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('borrower-avatars')
      .getPublicUrl(fileName)

    onPhotoChange && onPhotoChange(publicUrl)
    setUploading(false)
  }

  const handleRemove = (e) => {
    e.stopPropagation()
    onPhotoChange && onPhotoChange(null)
  }

  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0, cursor: editable ? 'pointer' : 'default' }}
      onMouseEnter={() => editable && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => editable && !photoUrl && fileRef.current?.click()}
    >
      {photoUrl ? (
        // Photo avatar
        <img
          src={photoUrl}
          alt={name}
          style={{ width: size, height: size, borderRadius, objectFit: 'cover', border: `2px solid ${colors[0]}40` }}
        />
      ) : (
        // Auto-generated avatar
        <div style={{
          width: size, height: size, borderRadius, overflow: 'hidden',
          background: `linear-gradient(135deg, ${colors[0]}25, ${colors[1]}25)`,
          border: `2px solid ${colors[0]}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative'
        }}>
          {/* Pattern background */}
          <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }} viewBox="0 0 46 46">
            <AvatarPattern pattern={pattern} color={colors[0]} />
          </svg>
          {/* Initials */}
          <span style={{
            position: 'relative', zIndex: 1,
            fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800,
            fontSize: size > 60 ? size * 0.28 : size * 0.32,
            background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', letterSpacing: '-0.02em', lineHeight: 1
          }}>
            {initials}
          </span>
        </div>
      )}

      {/* Edit overlay */}
      {editable && hover && (
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 3
          }}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <>
              <Camera size={size > 50 ? 16 : 13} color="#fff" />
              {size > 50 && <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>Change</span>}
            </>
          )}
        </div>
      )}

      {/* Remove photo button */}
      {editable && photoUrl && hover && (
        <button
          onClick={handleRemove}
          style={{
            position: 'absolute', top: -6, right: -6,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--red)', border: '2px solid var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10
          }}
        >
          <X size={9} color="#fff" />
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  )
}

// Large avatar for modal/profile view with upload prompt
export function BorrowerAvatarUpload({ name, photoUrl, onPhotoChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <BorrowerAvatar name={name} photoUrl={photoUrl} size={80} editable onPhotoChange={onPhotoChange} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {photoUrl ? 'Hover to change photo' : 'Click to upload photo'}
      </span>
    </div>
  )
}

export default BorrowerAvatar
