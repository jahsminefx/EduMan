import axios from 'axios';

export const contentTypeOptions = [
  ['lesson_note', 'Lesson Note'],
  ['study_guide', 'Study Guide'],
  ['class_summary', 'Class Summary'],
  ['assignment', 'Assignment'],
  ['revision_note', 'Revision Note'],
  ['exam_preparation_note', 'Exam Preparation Note'],
];

export function applyOptionDefaults(data, setForm) {
  const activeSession = data.sessions?.find(item => item.is_active === 1) || data.sessions?.[0];
  const activeTerm = data.terms?.find(item => item.is_active === 1 && (!activeSession || item.session_id === activeSession.id))
    || data.terms?.find(item => !activeSession || item.session_id === activeSession.id);
  const assignment = data.assignments?.[0];

  setForm(current => ({
    ...current,
    class_id: current.class_id || assignment?.class_id || '',
    subject_id: current.subject_id || assignment?.subject_id || '',
    academic_session_id: current.academic_session_id || activeSession?.id || '',
    term_id: current.term_id || activeTerm?.id || '',
  }));
}

export function selectAssignment(value, setForm) {
  const [classId, subjectId] = value.split(':');
  setForm(current => ({ ...current, class_id: classId, subject_id: subjectId }));
}

export function assignmentValue(form) {
  return form.class_id && form.subject_id ? `${form.class_id}:${form.subject_id}` : '';
}

export async function downloadProtected(url, fallbackName) {
  const response = await axios.get(url, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function displayLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}
