import { Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { NetworkAnalyzer } from './pages/NetworkAnalyzer'
import { EmailAnalyzer } from './pages/EmailAnalyzer'
import { ThreatIntel } from './pages/ThreatIntel'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/network" element={<NetworkAnalyzer />} />
      <Route path="/email" element={<EmailAnalyzer />} />
      <Route path="/threat-intel" element={<ThreatIntel />} />
    </Routes>
  )
}
