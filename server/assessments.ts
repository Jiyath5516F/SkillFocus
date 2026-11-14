// Assessment banks with answer keys. Server-only: answer keys never reach the client.
import type { PublicAssessment } from '../shared/types';

interface Question { id: string; concept: string; prompt: string; code?: string; options: string[]; answer: number; explanation: string }
export interface AssessmentDef { id: string; skillId: string; title: string; concepts: Record<string, string>; questions: Question[] }

export const ASSESSMENTS: AssessmentDef[] = [
  {
    id: 'js-core',
    skillId: 'javascript',
    title: 'JavaScript Core Check',
    concepts: { types: 'Types & equality', closures: 'Scope & closures', arrays_objects: 'Arrays & objects', async: 'Async & promises', dom: 'DOM & events' },
    questions: [
      { id: 'js1', concept: 'types', prompt: 'What does this print?', code: 'console.log(typeof null);', options: ['"null"', '"object"', '"undefined"', '"number"'], answer: 1, explanation: 'typeof null is "object" — a historical quirk of JavaScript.' },
      { id: 'js2', concept: 'types', prompt: 'What are the results of these comparisons?', code: "0 == '0';   // ?\n0 === '0';  // ?", options: ['true, true', 'false, false', 'true, false', 'false, true'], answer: 2, explanation: '== coerces types before comparing; === compares type and value, so 0 !== "0".' },
      { id: 'js3', concept: 'closures', prompt: 'What does this print?', code: 'function counter() {\n  let n = 0;\n  return () => ++n;\n}\nconst c = counter();\nc();\nconsole.log(c());', options: ['0', '1', '2', 'undefined'], answer: 2, explanation: 'The returned arrow function closes over n, so state persists between calls: 1, then 2.' },
      { id: 'js4', concept: 'closures', prompt: 'What does this print (after the timers run)?', code: 'for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i));\n}', options: ['0 1 2', '3 3 3', 'undefined ×3', '0 0 0'], answer: 1, explanation: 'var is function-scoped, so all callbacks share one i, which is 3 when they run. let would print 0 1 2.' },
      { id: 'js5', concept: 'arrays_objects', prompt: 'What is the result?', code: '[1, 2, 3].map(x => x * 2).filter(x => x > 2);', options: ['[2, 4, 6]', '[4, 6]', '[3]', '[2]'], answer: 1, explanation: 'map gives [2, 4, 6]; filter keeps values greater than 2 → [4, 6].' },
      { id: 'js6', concept: 'async', prompt: 'In what order are the letters logged?', code: "console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nconsole.log('D');", options: ['A B C D', 'A D B C', 'A D C B', 'A C D B'], answer: 2, explanation: 'Synchronous code runs first (A, D), then microtasks (promise → C), then macrotasks (timeout → B).' },
      { id: 'js7', concept: 'async', prompt: 'What does an async function always return?', options: ['The value of its return statement', 'A Promise', 'undefined until awaited', 'A callback'], answer: 1, explanation: 'An async function always returns a Promise that resolves to its return value.' },
      { id: 'js8', concept: 'dom', prompt: 'Which attaches a click handler without replacing handlers that are already attached?', options: ["el.onclick = fn", "el.addEventListener('click', fn)", "el.click(fn)", "el.setAttribute('onclick', fn)"], answer: 1, explanation: 'addEventListener registers additional listeners; assigning onclick replaces the previous handler.' },
    ],
  },
  {
    id: 'sql-core',
    skillId: 'sql',
    title: 'SQL for Analysis Check',
    concepts: { filtering: 'Filtering & sorting', joins: 'Joins', aggregation: 'Aggregation', subqueries: 'Subqueries & NULLs' },
    questions: [
      { id: 'sq1', concept: 'filtering', prompt: 'Which clause filters rows before grouping?', options: ['HAVING', 'WHERE', 'ORDER BY', 'GROUP BY'], answer: 1, explanation: 'WHERE filters rows before aggregation; HAVING filters groups after it.' },
      { id: 'sq2', concept: 'joins', prompt: 'Which join keeps every customer, even those with no orders?', code: 'SELECT c.name, o.id\nFROM customers c\n____ orders o ON o.customer_id = c.id;', options: ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN on customers', 'CROSS JOIN'], answer: 1, explanation: 'LEFT JOIN keeps all rows from the left table (customers) and fills missing order columns with NULL.' },
      { id: 'sq3', concept: 'aggregation', prompt: 'How do you keep only categories with more than 10 products?', options: ['WHERE COUNT(*) > 10', 'HAVING COUNT(*) > 10', 'FILTER COUNT(*) > 10', 'GROUP BY COUNT(*) > 10'], answer: 1, explanation: 'Aggregate conditions go in HAVING, after GROUP BY.' },
      { id: 'sq4', concept: 'subqueries', prompt: 'What does `WHERE discount = NULL` return?', options: ['Rows with no discount', 'No rows', 'All rows', 'A syntax error'], answer: 1, explanation: 'Comparisons with NULL are unknown, never true. Use IS NULL.' },
      { id: 'sq5', concept: 'aggregation', prompt: 'COUNT(column) differs from COUNT(*) because it…', options: ['counts distinct values', 'ignores NULLs in that column', 'is faster', 'counts columns'], answer: 1, explanation: 'COUNT(column) skips NULLs; COUNT(*) counts every row.' },
    ],
  },
  {
    id: 'py-core',
    skillId: 'python',
    title: 'Python Fundamentals Check',
    concepts: { data_structures: 'Data structures', functions: 'Functions & scope', comprehensions: 'Comprehensions & iteration', errors: 'Errors & files' },
    questions: [
      { id: 'py1', concept: 'data_structures', prompt: 'What does this print?', code: 'a = [1, 2, 3]\nb = a\nb.append(4)\nprint(len(a))', options: ['3', '4', 'Error', 'None'], answer: 1, explanation: 'b and a reference the same list object, so appending through b also changes a.' },
      { id: 'py2', concept: 'data_structures', prompt: 'Which type can be used as a dictionary key?', options: ['list', 'dict', 'tuple of ints', 'set'], answer: 2, explanation: 'Keys must be hashable; tuples of immutable values are hashable, lists/dicts/sets are not.' },
      { id: 'py3', concept: 'functions', prompt: 'What does this print on the second call?', code: 'def add(item, bucket=[]):\n    bucket.append(item)\n    return bucket\n\nadd(1)\nprint(add(2))', options: ['[2]', '[1, 2]', '[]', 'Error'], answer: 1, explanation: 'Default arguments are evaluated once, so the same list is reused across calls. Use bucket=None instead.' },
      { id: 'py4', concept: 'comprehensions', prompt: 'What is the result?', code: '[x * x for x in range(5) if x % 2 == 0]', options: ['[0, 4, 16]', '[1, 9]', '[0, 1, 4, 9, 16]', '[4, 16]'], answer: 0, explanation: 'range(5) gives 0–4; keeping even numbers 0, 2, 4 and squaring gives [0, 4, 16].' },
      { id: 'py5', concept: 'comprehensions', prompt: 'What does `zip([1, 2, 3], "ab")` produce when converted to a list?', options: ["[(1, 'a'), (2, 'b'), (3, None)]", "[(1, 'a'), (2, 'b')]", 'An error', "[1, 'a', 2, 'b']"], answer: 1, explanation: 'zip stops at the shortest iterable.' },
      { id: 'py6', concept: 'errors', prompt: 'Why is `with open("data.csv") as f:` preferred over `f = open("data.csv")`?', options: ['It reads faster', 'It closes the file even if an error occurs', 'It loads the file into memory', 'It is required for CSV files'], answer: 1, explanation: 'The context manager guarantees the file is closed when the block exits, including on exceptions.' },
    ],
  },
];

export const ASSESSMENT_BY_ID: Record<string, AssessmentDef> = Object.fromEntries(ASSESSMENTS.map((a) => [a.id, a]));

export function toPublic(a: AssessmentDef): PublicAssessment {
  return {
    id: a.id, skillId: a.skillId, title: a.title, concepts: a.concepts,
    questions: a.questions.map(({ id, concept, prompt, code, options }) => ({ id, concept, prompt, code, options })),
  };
}
