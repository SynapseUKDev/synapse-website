export function buildMockReviewSession(data) {
  const rawQuestions = Array.isArray(data?.questions) ? data.questions : []
  const questions = rawQuestions.map((q) => ({
    id: q.id,
    stem: q.stem,
    type: q.type || 'MCQ',
    options: q.options || [],
    correct_answer: q.correct_option_index,
    explanations: q.explanations || {},
  }))

  const userAnswers = {}
  for (const q of rawQuestions) {
    if (q.skipped) {
      userAnswers[q.id] = { submitted: false }
    } else {
      userAnswers[q.id] = {
        selected: q.selected_option_index,
        submitted: true,
        isCorrect: !!q.is_correct,
      }
    }
  }

  return {
    questions,
    userAnswers,
    sessionStats: {
      correct: data?.correct ?? 0,
      totalQuestions: data?.total ?? questions.length,
      skipped: data?.skipped ?? 0,
      attemptId: data?.attempt_id ?? null,
      paperTitle: data?.paper_title ?? null,
    },
  }
}
