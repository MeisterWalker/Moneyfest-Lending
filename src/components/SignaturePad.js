import { useState, useRef, useEffect } from 'react'
import { CheckCircle2, Eraser, XCircle } from 'lucide-react'

export function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
    
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top
    
    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasContent(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #ddd', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', width: '100%', maxWidth: 500 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontFamily: 'Inter', fontSize: 14, fontWeight: 700, color: '#1a1a1a', textTransform: 'uppercase' }}>Digital Signature Pad</h4>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><XCircle size={20} /></button>
      </div>
      
      <canvas 
        ref={canvasRef}
        width={450}
        height={200}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{ border: '2px dashed #ccc', borderRadius: 8, cursor: 'crosshair', width: '100%', touchAction: 'none' }}
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={clear} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', color: '#1a1a1a', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Eraser size={16} /> Clear
        </button>
        <button 
          onClick={handleSave} 
          disabled={!hasContent}
          style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: hasContent ? '#000' : '#ccc', color: '#fff', fontSize: 13, fontWeight: 700, cursor: hasContent ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CheckCircle2 size={16} /> Adopt Signature
        </button>
      </div>
    </div>
  )
}
