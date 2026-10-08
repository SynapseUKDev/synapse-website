import React from 'react'
import { Navigate, Route } from 'react-router-dom'
import Flashcards from './osce/Flashcards.jsx'
import FlashcardsV2 from './osce/FlashcardsV2.jsx'

const ENTRY = '/dashboard/question-bank/flashcards'

/**
 * The Flashcards routes under /dashboard. V2 is the normal Flashcards entry; who may study is decided by
 * the server (FLASHCARDS_V2_RELEASED — until it is set, only admins load cards and everyone else sees a
 * coming-soon notice). V1 stays reachable at .../flashcards-v1 as a rollback route (no nav link); the old
 * beta URL and the legacy osce/flashcards path redirect to the entry. Called as a function (not rendered
 * as a component) so <Routes> sees the <Route> elements directly.
 */
export function flashcardsRoutes() {
  return (
    <>
      <Route path="question-bank/flashcards" element={<FlashcardsV2 />} />
      <Route path="question-bank/flashcards-v1" element={<Flashcards />} />
      <Route path="question-bank/flashcards-v2" element={<Navigate to={ENTRY} replace />} />
      <Route path="osce/flashcards" element={<Navigate to={ENTRY} replace />} />
    </>
  )
}
