import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './landing/Landing.jsx'
import Auth from './auth/Auth.jsx'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
