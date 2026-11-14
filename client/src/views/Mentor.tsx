import { MentorChat } from '../components/MentorChat';
import { MiraAvatar } from '../components/MiraAvatar';

export function Mentor() {
  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <MiraAvatar size="lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Ask Mira</h1>
          <p className="mt-1 text-sm text-white/60">Your mentor answers from your actual profile, evidence, assessments and roadmap history — never invented achievements.</p>
        </div>
      </div>
      <div className="min-h-0 flex-1"><MentorChat /></div>
    </div>
  );
}
