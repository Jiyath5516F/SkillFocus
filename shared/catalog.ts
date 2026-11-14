import type { Resource, RoleDef, SkillDef } from './types';

/** Lookup table without a prototype, so IDs like "toString" or "__proto__" never resolve to built-ins. */
export function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.assign(Object.create(null) as Record<string, T>, Object.fromEntries(items.map((i) => [i.id, i])));
}

export const LEVEL_LABELS = ['None', 'Basic', 'Working', 'Proficient', 'Advanced'] as const;

export const SKILLS: SkillDef[] = [
  {
    id: 'html',
    name: 'HTML & CSS',
    category: 'Web',
    prereqs: [],
    defaultExercise: 'Build a responsive personal portfolio page with semantic HTML and a CSS grid layout.',
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    category: 'Web',
    prereqs: [],
    defaultExercise: 'Build a to-do list with add/complete/delete, persisted to localStorage, using only vanilla JS.',
  },
  {
    id: 'react',
    name: 'React',
    category: 'Web',
    prereqs: ['javascript', 'html'],
    defaultExercise: 'Rebuild your to-do app in React with components, props, state and a fetch to a public API.',
  },
  {
    id: 'nodejs',
    name: 'Node.js & Express',
    category: 'Web',
    prereqs: ['javascript'],
    defaultExercise: 'Create an Express API with CRUD endpoints for notes, input validation and error handling.',
  },
  {
    id: 'rest_api',
    name: 'REST API Design',
    category: 'Web',
    prereqs: ['nodejs'],
    defaultExercise: 'Design and document a REST API (resources, status codes, pagination) for a library system.',
  },
  {
    id: 'git',
    name: 'Git & GitHub',
    category: 'Tools',
    prereqs: [],
    defaultExercise: 'Use feature branches, pull requests and a merge-conflict resolution on a small repo.',
  },
  {
    id: 'sql',
    name: 'SQL',
    category: 'Data',
    prereqs: [],
    defaultExercise: 'Answer 10 business questions on a sample sales database using JOINs, GROUP BY and subqueries.',
  },
  {
    id: 'python',
    name: 'Python',
    category: 'Programming',
    prereqs: [],
    defaultExercise: 'Write a CLI tool that reads a CSV, cleans it and prints summary statistics.',
  },
  {
    id: 'excel',
    name: 'Spreadsheets & Excel',
    category: 'Data',
    prereqs: [],
    defaultExercise: 'Build a pivot-table dashboard with lookups and conditional formatting from raw sales data.',
  },
  {
    id: 'statistics',
    name: 'Statistics',
    category: 'Data',
    prereqs: [],
    defaultExercise: 'Run and interpret an A/B test: hypotheses, p-value, confidence interval and a recommendation.',
  },
  {
    id: 'pandas',
    name: 'Pandas & Data Wrangling',
    category: 'Data',
    prereqs: ['python'],
    defaultExercise: 'Clean and merge two messy datasets with pandas and produce a tidy analysis table.',
  },
  {
    id: 'data_viz',
    name: 'Data Visualization',
    category: 'Data',
    prereqs: [],
    defaultExercise: 'Tell a 5-chart story about a public dataset, choosing the right chart type for each question.',
  },
  {
    id: 'bi_tools',
    name: 'Power BI / Tableau',
    category: 'Data',
    prereqs: ['excel'],
    defaultExercise: 'Publish an interactive dashboard with filters and drill-downs from a sales dataset.',
  },
  {
    id: 'math_ml',
    name: 'Linear Algebra & Calculus for ML',
    category: 'AI/ML',
    prereqs: [],
    defaultExercise: 'Implement gradient descent for linear regression from scratch with NumPy.',
  },
  {
    id: 'ml',
    name: 'Machine Learning Fundamentals',
    category: 'AI/ML',
    prereqs: ['python', 'statistics'],
    defaultExercise: 'Train, cross-validate and compare two scikit-learn models on a tabular dataset.',
  },
  {
    id: 'deep_learning',
    name: 'Deep Learning',
    category: 'AI/ML',
    prereqs: ['ml', 'math_ml'],
    defaultExercise: 'Fine-tune a pretrained image classifier and report validation accuracy.',
  },
  {
    id: 'llm_apps',
    name: 'LLM & GenAI Applications',
    category: 'AI/ML',
    prereqs: ['python'],
    defaultExercise: 'Build a small retrieval-augmented Q&A app over your own notes with an LLM API.',
  },
  {
    id: 'mlops',
    name: 'Model Deployment & MLOps',
    category: 'AI/ML',
    prereqs: ['ml', 'git'],
    defaultExercise: 'Serve a trained model behind an HTTP endpoint with versioning and a basic monitoring metric.',
  },
];

export const SKILL_BY_ID = indexById(SKILLS);

export const ROLES: RoleDef[] = [
  {
    id: 'fullstack',
    title: 'Full Stack Developer',
    summary: 'Builds web applications end to end: interface, API and database.',
    requirements: [
      { skillId: 'javascript', level: 3, weight: 3 },
      { skillId: 'react', level: 3, weight: 3 },
      { skillId: 'nodejs', level: 3, weight: 3 },
      { skillId: 'html', level: 2, weight: 2 },
      { skillId: 'sql', level: 2, weight: 2 },
      { skillId: 'rest_api', level: 2, weight: 2 },
      { skillId: 'git', level: 2, weight: 2 },
    ],
  },
  {
    id: 'data_analyst',
    title: 'Data Analyst',
    summary: 'Turns raw data into decisions with SQL, statistics and clear visual stories.',
    requirements: [
      { skillId: 'sql', level: 3, weight: 3 },
      { skillId: 'statistics', level: 3, weight: 3 },
      { skillId: 'data_viz', level: 3, weight: 3 },
      { skillId: 'python', level: 2, weight: 2 },
      { skillId: 'pandas', level: 2, weight: 2 },
      { skillId: 'excel', level: 2, weight: 2 },
      { skillId: 'bi_tools', level: 2, weight: 1 },
    ],
  },
  {
    id: 'aiml',
    title: 'AI/ML Engineer',
    summary: 'Builds, evaluates and ships machine-learning and LLM-powered systems.',
    requirements: [
      { skillId: 'python', level: 3, weight: 3 },
      { skillId: 'ml', level: 3, weight: 3 },
      { skillId: 'statistics', level: 2, weight: 2 },
      { skillId: 'math_ml', level: 2, weight: 2 },
      { skillId: 'deep_learning', level: 2, weight: 2 },
      { skillId: 'llm_apps', level: 2, weight: 2 },
      { skillId: 'mlops', level: 2, weight: 1 },
      { skillId: 'git', level: 2, weight: 1 },
    ],
  },
];

export const ROLE_BY_ID = indexById(ROLES);

/** Custom roles (designed with Mira) are stored per account and registered at runtime under unique ids. */
export function registerRoles(roles: RoleDef[] | undefined) {
  for (const r of roles ?? []) if (r.id.startsWith('custom-')) ROLE_BY_ID[r.id] = r;
}

// Curated, free, well-known learning resources. Only these IDs may be recommended by agents.
export const RESOURCES: readonly Resource[] = [
  {
    id: 'mdn-learn-web',
    skillId: 'html',
    title: 'Learn web development',
    provider: 'MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development',
    kind: 'course',
    hours: 10,
  },
  {
    id: 'fcc-rwd',
    skillId: 'html',
    title: 'Responsive Web Design certification',
    provider: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/learn/2022/responsive-web-design/',
    kind: 'practice',
    hours: 15,
  },

  {
    id: 'jsinfo',
    skillId: 'javascript',
    title: 'The Modern JavaScript Tutorial',
    provider: 'javascript.info',
    url: 'https://javascript.info/',
    kind: 'tutorial',
    hours: 20,
  },
  {
    id: 'mdn-js-guide',
    skillId: 'javascript',
    title: 'JavaScript Guide',
    provider: 'MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
    kind: 'docs',
    hours: 10,
  },
  {
    id: 'eloquent-js',
    skillId: 'javascript',
    title: 'Eloquent JavaScript (4th ed.)',
    provider: 'Marijn Haverbeke',
    url: 'https://eloquentjavascript.net/',
    kind: 'book',
    hours: 25,
  },
  {
    id: 'jsinfo-types',
    skillId: 'javascript',
    title: 'Comparisons and type conversions',
    provider: 'javascript.info',
    url: 'https://javascript.info/comparison',
    kind: 'tutorial',
    hours: 1,
    concepts: ['types'],
  },
  {
    id: 'mdn-closures',
    skillId: 'javascript',
    title: 'Closures',
    provider: 'MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures',
    kind: 'docs',
    hours: 1,
    concepts: ['closures'],
  },
  {
    id: 'jsinfo-closure',
    skillId: 'javascript',
    title: 'Variable scope, closure',
    provider: 'javascript.info',
    url: 'https://javascript.info/closure',
    kind: 'tutorial',
    hours: 2,
    concepts: ['closures'],
  },
  {
    id: 'jsinfo-array-methods',
    skillId: 'javascript',
    title: 'Array methods',
    provider: 'javascript.info',
    url: 'https://javascript.info/array-methods',
    kind: 'tutorial',
    hours: 2,
    concepts: ['arrays_objects'],
  },
  {
    id: 'jsinfo-object',
    skillId: 'javascript',
    title: 'Objects',
    provider: 'javascript.info',
    url: 'https://javascript.info/object',
    kind: 'tutorial',
    hours: 1,
    concepts: ['arrays_objects'],
  },
  {
    id: 'jsinfo-async',
    skillId: 'javascript',
    title: 'Promises, async/await',
    provider: 'javascript.info',
    url: 'https://javascript.info/async',
    kind: 'tutorial',
    hours: 3,
    concepts: ['async'],
  },
  {
    id: 'mdn-promises',
    skillId: 'javascript',
    title: 'Using promises',
    provider: 'MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
    kind: 'docs',
    hours: 1,
    concepts: ['async'],
  },
  {
    id: 'jsinfo-dom',
    skillId: 'javascript',
    title: 'Document & events',
    provider: 'javascript.info',
    url: 'https://javascript.info/document',
    kind: 'tutorial',
    hours: 3,
    concepts: ['dom'],
  },

  {
    id: 'react-learn',
    skillId: 'react',
    title: 'Learn React',
    provider: 'react.dev',
    url: 'https://react.dev/learn',
    kind: 'docs',
    hours: 12,
  },
  {
    id: 'react-tictactoe',
    skillId: 'react',
    title: 'Tutorial: Tic-Tac-Toe',
    provider: 'react.dev',
    url: 'https://react.dev/learn/tutorial-tic-tac-toe',
    kind: 'practice',
    hours: 3,
  },
  {
    id: 'fullstackopen',
    skillId: 'react',
    title: 'Full Stack Open',
    provider: 'University of Helsinki',
    url: 'https://fullstackopen.com/en/',
    kind: 'course',
    hours: 40,
  },

  {
    id: 'node-learn',
    skillId: 'nodejs',
    title: 'Introduction to Node.js',
    provider: 'nodejs.org',
    url: 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs',
    kind: 'docs',
    hours: 6,
  },
  {
    id: 'express-start',
    skillId: 'nodejs',
    title: 'Express — Getting started',
    provider: 'expressjs.com',
    url: 'https://expressjs.com/en/starter/installing.html',
    kind: 'docs',
    hours: 3,
  },
  {
    id: 'odin-node',
    skillId: 'nodejs',
    title: 'NodeJS course',
    provider: 'The Odin Project',
    url: 'https://www.theodinproject.com/paths/full-stack-javascript/courses/nodejs',
    kind: 'course',
    hours: 30,
  },

  {
    id: 'mdn-http',
    skillId: 'rest_api',
    title: 'An overview of HTTP',
    provider: 'MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview',
    kind: 'docs',
    hours: 2,
  },
  {
    id: 'ms-api-design',
    skillId: 'rest_api',
    title: 'RESTful web API design',
    provider: 'Microsoft Learn',
    url: 'https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design',
    kind: 'docs',
    hours: 3,
  },

  {
    id: 'pro-git',
    skillId: 'git',
    title: 'Pro Git book',
    provider: 'git-scm.com',
    url: 'https://git-scm.com/book/en/v2',
    kind: 'book',
    hours: 8,
  },
  {
    id: 'github-skills',
    skillId: 'git',
    title: 'GitHub Skills',
    provider: 'GitHub',
    url: 'https://skills.github.com/',
    kind: 'practice',
    hours: 4,
  },

  {
    id: 'sqlbolt',
    skillId: 'sql',
    title: 'SQLBolt interactive lessons',
    provider: 'SQLBolt',
    url: 'https://sqlbolt.com/',
    kind: 'practice',
    hours: 4,
  },
  {
    id: 'mode-sql',
    skillId: 'sql',
    title: 'SQL Tutorial for Data Analysis',
    provider: 'Mode',
    url: 'https://mode.com/sql-tutorial/',
    kind: 'tutorial',
    hours: 8,
  },
  {
    id: 'pg-tutorial',
    skillId: 'sql',
    title: 'PostgreSQL tutorial',
    provider: 'postgresql.org',
    url: 'https://www.postgresql.org/docs/current/tutorial.html',
    kind: 'docs',
    hours: 5,
  },

  {
    id: 'py-tutorial',
    skillId: 'python',
    title: 'The Python Tutorial',
    provider: 'python.org',
    url: 'https://docs.python.org/3/tutorial/',
    kind: 'docs',
    hours: 10,
  },
  {
    id: 'kaggle-python',
    skillId: 'python',
    title: 'Python micro-course',
    provider: 'Kaggle Learn',
    url: 'https://www.kaggle.com/learn/python',
    kind: 'course',
    hours: 5,
  },

  {
    id: 'ms-excel',
    skillId: 'excel',
    title: 'Excel help & learning',
    provider: 'Microsoft',
    url: 'https://support.microsoft.com/en-us/excel',
    kind: 'tutorial',
    hours: 6,
  },

  {
    id: 'khan-stats',
    skillId: 'statistics',
    title: 'Statistics and probability',
    provider: 'Khan Academy',
    url: 'https://www.khanacademy.org/math/statistics-probability',
    kind: 'course',
    hours: 20,
  },
  {
    id: 'openintro',
    skillId: 'statistics',
    title: 'OpenIntro Statistics',
    provider: 'OpenIntro',
    url: 'https://www.openintro.org/book/os/',
    kind: 'book',
    hours: 25,
  },

  {
    id: 'kaggle-pandas',
    skillId: 'pandas',
    title: 'Pandas micro-course',
    provider: 'Kaggle Learn',
    url: 'https://www.kaggle.com/learn/pandas',
    kind: 'course',
    hours: 4,
  },
  {
    id: 'pandas-start',
    skillId: 'pandas',
    title: 'Getting started with pandas',
    provider: 'pandas.pydata.org',
    url: 'https://pandas.pydata.org/docs/getting_started/index.html',
    kind: 'docs',
    hours: 4,
  },

  {
    id: 'kaggle-dataviz',
    skillId: 'data_viz',
    title: 'Data Visualization micro-course',
    provider: 'Kaggle Learn',
    url: 'https://www.kaggle.com/learn/data-visualization',
    kind: 'course',
    hours: 4,
  },
  {
    id: 'wilke-dataviz',
    skillId: 'data_viz',
    title: 'Fundamentals of Data Visualization',
    provider: 'Claus O. Wilke',
    url: 'https://clauswilke.com/dataviz/',
    kind: 'book',
    hours: 12,
  },

  {
    id: 'ms-powerbi',
    skillId: 'bi_tools',
    title: 'Power BI training',
    provider: 'Microsoft Learn',
    url: 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi',
    kind: 'course',
    hours: 10,
  },
  {
    id: 'tableau-training',
    skillId: 'bi_tools',
    title: 'Free Tableau training videos',
    provider: 'Tableau',
    url: 'https://www.tableau.com/learn/training',
    kind: 'course',
    hours: 8,
  },

  {
    id: 'mml-book',
    skillId: 'math_ml',
    title: 'Mathematics for Machine Learning',
    provider: 'Deisenroth, Faisal & Ong',
    url: 'https://mml-book.github.io/',
    kind: 'book',
    hours: 30,
  },
  {
    id: '3b1b-linalg',
    skillId: 'math_ml',
    title: 'Essence of linear algebra',
    provider: '3Blue1Brown',
    url: 'https://www.3blue1brown.com/topics/linear-algebra',
    kind: 'tutorial',
    hours: 4,
  },

  {
    id: 'google-mlcc',
    skillId: 'ml',
    title: 'Machine Learning Crash Course',
    provider: 'Google',
    url: 'https://developers.google.com/machine-learning/crash-course',
    kind: 'course',
    hours: 15,
  },
  {
    id: 'kaggle-intro-ml',
    skillId: 'ml',
    title: 'Intro to Machine Learning',
    provider: 'Kaggle Learn',
    url: 'https://www.kaggle.com/learn/intro-to-machine-learning',
    kind: 'course',
    hours: 3,
  },
  {
    id: 'sklearn-tutorial',
    skillId: 'ml',
    title: 'Getting started with scikit-learn',
    provider: 'scikit-learn',
    url: 'https://scikit-learn.org/stable/getting_started.html',
    kind: 'docs',
    hours: 6,
  },

  {
    id: 'fastai',
    skillId: 'deep_learning',
    title: 'Practical Deep Learning for Coders',
    provider: 'fast.ai',
    url: 'https://course.fast.ai/',
    kind: 'course',
    hours: 30,
  },
  {
    id: 'pytorch-tutorials',
    skillId: 'deep_learning',
    title: 'PyTorch tutorials',
    provider: 'pytorch.org',
    url: 'https://pytorch.org/tutorials/',
    kind: 'docs',
    hours: 10,
  },

  {
    id: 'hf-llm-course',
    skillId: 'llm_apps',
    title: 'LLM Course',
    provider: 'Hugging Face',
    url: 'https://huggingface.co/learn/llm-course',
    kind: 'course',
    hours: 20,
  },
  {
    id: 'claude-docs',
    skillId: 'llm_apps',
    title: 'Claude Developer Platform docs',
    provider: 'Anthropic',
    url: 'https://docs.claude.com/',
    kind: 'docs',
    hours: 4,
  },

  {
    id: 'madewithml',
    skillId: 'mlops',
    title: 'Made With ML',
    provider: 'Made With ML',
    url: 'https://madewithml.com/',
    kind: 'course',
    hours: 20,
  },
  {
    id: 'mlops-zoomcamp',
    skillId: 'mlops',
    title: 'MLOps Zoomcamp',
    provider: 'DataTalks.Club',
    url: 'https://github.com/DataTalksClub/mlops-zoomcamp',
    kind: 'course',
    hours: 30,
  },
];

const CURATED_BY_ID = indexById([...RESOURCES]);

export const skillName = (id: string) => SKILL_BY_ID[id]?.name ?? id;

/**
 * Custom skills (added by the learner or proposed for a custom aim) are registered at runtime under owner-scoped ids.
 * They have no curated course list, so they get transparent *search* links instead of invented URLs. Those links are
 * derived from the skill on demand, so nothing user-specific is ever added to the shared curated catalog.
 */
export function registerSkills(skills: SkillDef[] | undefined) {
  for (const sk of skills ?? []) if (sk.id.startsWith('cs-') && !SKILL_BY_ID[sk.id]) SKILL_BY_ID[sk.id] = sk;
}

const SEARCH_LINKS = {
  yt: {
    provider: 'YouTube',
    hours: 6,
    title: '%s tutorials (YouTube search)',
    url: 'https://www.youtube.com/results?search_query=%s+tutorial',
  },
  coursera: {
    provider: 'Coursera',
    hours: 10,
    title: '%s courses (Coursera search)',
    url: 'https://www.coursera.org/search?query=%s',
  },
} as const;

function searchResource(skill: SkillDef, key: keyof typeof SEARCH_LINKS): Resource {
  const l = SEARCH_LINKS[key];
  return {
    id: `${skill.id}~${key}`,
    skillId: skill.id,
    kind: 'search',
    provider: l.provider,
    hours: l.hours,
    title: l.title.replace('%s', skill.name),
    url: l.url.replace('%s', encodeURIComponent(skill.name)),
  };
}

/** Learning resources for a skill: the curated list for catalog skills, search links for custom skills. */
export function resourcesForSkill(skillId: string): Resource[] {
  const skill = SKILL_BY_ID[skillId];
  if (skill?.id.startsWith('cs-'))
    return (Object.keys(SEARCH_LINKS) as (keyof typeof SEARCH_LINKS)[]).map((k) => searchResource(skill, k));
  return RESOURCES.filter((r) => r.skillId === skillId);
}

/** Resolves resource ids, silently dropping unknown ones (e.g. a custom skill that was later removed). */
export function resolveResources(ids: readonly string[]): Resource[] {
  return ids.map(findResource).filter((r): r is Resource => r !== undefined);
}

/** Looks up a resource id from either the curated catalog or a registered custom skill's search links. */
export function findResource(id: string): Resource | undefined {
  if (CURATED_BY_ID[id]) return CURATED_BY_ID[id];
  const [skillId, key] = id.split('~');
  const skill = SKILL_BY_ID[skillId];
  return skill?.id.startsWith('cs-') && Object.hasOwn(SEARCH_LINKS, key)
    ? searchResource(skill, key as keyof typeof SEARCH_LINKS)
    : undefined;
}

/** Builds a custom skill definition for a free-text skill name. */
export function customSkill(ownerId: number | string, name: string): SkillDef {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 60);
  const slug =
    clean
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'skill';
  return {
    id: `cs-${ownerId}-${slug}`,
    name: clean,
    category: 'Custom',
    prereqs: [],
    defaultExercise: `Build a small, real project that uses ${clean} and write down what you learned.`,
  };
}

/** Finds a catalog or registered skill by id or (case-insensitive) name. */
export function findSkill(idOrName: string): SkillDef | undefined {
  const k = idOrName.trim().toLowerCase();
  return SKILL_BY_ID[idOrName] ?? Object.values(SKILL_BY_ID).find((s) => s.name.toLowerCase() === k || s.id === k);
}

/** Human-readable label for a stable milestone key (learn:<skill> | fix:<skill>:<concept>). */
export function milestoneLabel(key: string): string {
  const [kind, skill, concept] = key.split(':');
  if (kind === 'learn') return `Learn ${skillName(skill)}`;
  if (kind === 'fix') return `${skillName(skill)} remediation (${concept.replace(/_/g, ' ')})`;
  return key;
}
