// Reproducible demo learner (official sample scenario).
import type { Profile } from '../shared/types';
import { addMessage, getProfile, resetAll, saveProfile } from './db';

export const DEMO_PROFILE: Profile = {
  name: 'Priya Raman',
  background: 'Final-year B.Sc. Computer Science student',
  currentRole: 'Student',
  skills: [
    { skillId: 'python', selfLevel: 3 },
    { skillId: 'sql', selfLevel: 2 },
    { skillId: 'html', selfLevel: 1 },
  ],
  certifications: [{ name: 'SQL (Basic) Certificate', issuer: 'HackerRank', year: 2025 }],
  projects: [{ name: 'Campus Library Tracker', description: 'Python + SQLite command-line app that tracks book loans and produces SQL reports on overdue items.' }],
  interests: 'Building web apps for student communities',
  targetRoleId: 'fullstack',
  weeklyHours: 8,
  onboarded: true,
};

/** Resets the current user's data to the official sample scenario (Python, SQL, basic HTML → Full Stack). */
export function seedDemo(force = false, name = DEMO_PROFILE.name) {
  if (!force && getProfile()) return;
  resetAll();
  saveProfile({ ...DEMO_PROFILE, name });
  addMessage('assistant', 'summary', `Hi ${name.split(' ')[0]}, I'm Mira. Your profile starts with a sample scenario (Python, SQL, basic HTML) — edit it in Profile, or run an analysis and my agent team will map your skills against your Full Stack Developer goal.`);
}

/** A brand-new account: only the name is known; the setup wizard (or Profile) fills in the rest. */
export function seedNewAccount(name: string) {
  resetAll();
  saveProfile({ name, background: '', currentRole: '', skills: [], certifications: [], projects: [], interests: '', targetRoleId: 'fullstack', weeklyHours: 6, onboarded: false });
  addMessage('assistant', 'summary', `Welcome, ${name.split(' ')[0]}! I'm Mira. Tell me your goal and skills (or skip and add them later in Profile), and my agent team will build your evidence-based roadmap.`);
}
