import { useState } from 'react'
import Titlebar from './Titlebar'
import Sidepane from './Sidepane'
import Viewport from './Viewport'
import './App.css'

export default function App() {
  const [sidepaneOpen, setSidepaneOpen] = useState(true)

  return (
    <div className="app">
      <Titlebar
        sidepaneOpen={sidepaneOpen}
        onToggleSidepane={() => setSidepaneOpen(v => !v)}
      />
      <div className="app__body">
        <Sidepane open={sidepaneOpen} />
        <Viewport />
      </div>
    </div>
  )
}
