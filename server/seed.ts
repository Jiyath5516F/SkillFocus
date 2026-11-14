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
};

export function seedDemo(force = false) {
  if (!force && getProfile()) return;
  resetAll();
  saveProfile(DEMO_PROFILE);
  addMessage('assistant', 'summary', "Hi Priya, I'm Mira. Run an analysis and my agent team will map your skills against your Full Stack Developer goal.");
}
