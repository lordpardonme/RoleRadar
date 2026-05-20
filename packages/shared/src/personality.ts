import type { PersonalityAnswer, PersonalityProfile, PersonalityQuestion, PersonalityTrait, WorkValue } from "./types.js";
import { clamp, round } from "./utils.js";

export const DEFAULT_PERSONALITY_ITEMS: PersonalityQuestion[] = [
  { id: "open_1", trait: "openness", prompt: "I enjoy learning unfamiliar tools, domains, or ideas." },
  { id: "open_2", trait: "openness", prompt: "I prefer proven routines over experimenting.", reverse: true },
  { id: "open_3", trait: "openness", prompt: "Ambiguous problems make work more interesting." },
  { id: "open_4", trait: "openness", prompt: "I avoid roles where priorities change often.", reverse: true },
  { id: "con_1", trait: "conscientiousness", prompt: "I plan work carefully before moving fast." },
  { id: "con_2", trait: "conscientiousness", prompt: "I can tolerate loose process if goals are clear.", reverse: true },
  { id: "con_3", trait: "conscientiousness", prompt: "I keep commitments visible and documented." },
  { id: "con_4", trait: "conscientiousness", prompt: "I am comfortable improvising without much structure.", reverse: true },
  { id: "extra_1", trait: "extraversion", prompt: "Frequent collaboration energizes me." },
  { id: "extra_2", trait: "extraversion", prompt: "I prefer long solo work blocks over group work.", reverse: true },
  { id: "extra_3", trait: "extraversion", prompt: "I enjoy presenting ideas to groups." },
  { id: "extra_4", trait: "extraversion", prompt: "High-meeting roles drain me quickly.", reverse: true },
  { id: "agree_1", trait: "agreeableness", prompt: "I look for consensus before pushing a decision." },
  { id: "agree_2", trait: "agreeableness", prompt: "Direct debate is usually better than harmony.", reverse: true },
  { id: "agree_3", trait: "agreeableness", prompt: "Supporting teammates is a major source of motivation." },
  { id: "agree_4", trait: "agreeableness", prompt: "I prefer individual wins over team wins.", reverse: true },
  { id: "stable_1", trait: "emotionalStability", prompt: "I stay steady when deadlines move or requirements shift." },
  { id: "stable_2", trait: "emotionalStability", prompt: "Urgent, high-pressure work quickly overwhelms me.", reverse: true },
  { id: "stable_3", trait: "emotionalStability", prompt: "I recover quickly from critical feedback." },
  { id: "stable_4", trait: "emotionalStability", prompt: "I need very predictable days to do my best work.", reverse: true }
];

export const DEFAULT_WORK_VALUES: Record<WorkValue, number> = {
  autonomy: 50,
  collaboration: 50,
  structure: 50,
  pace: 50,
  purpose: 50,
  learning: 50,
  stability: 50,
  compensation: 50,
  remote: 50
};

const TRAITS: PersonalityTrait[] = ["openness", "conscientiousness", "extraversion", "agreeableness", "emotionalStability"];

export function scorePersonality(
  answers: PersonalityAnswer[],
  workValues: Partial<Record<WorkValue, number>> = {}
): PersonalityProfile {
  const byId = new Map(answers.map((answer) => [answer.id, answer.value]));
  const traits = Object.fromEntries(
    TRAITS.map((trait) => {
      const items = DEFAULT_PERSONALITY_ITEMS.filter((item) => item.trait === trait);
      const scores = items.map((item) => {
        const raw = clamp(byId.get(item.id) ?? 3, 1, 5);
        const value = item.reverse ? 6 - raw : raw;
        return ((value - 1) / 4) * 100;
      });
      return [trait, round(scores.reduce((sum, score) => sum + score, 0) / scores.length)];
    })
  ) as Record<PersonalityTrait, number>;

  return {
    modelVersion: "big-five-work-values-v1",
    traits,
    workValues: {
      ...DEFAULT_WORK_VALUES,
      ...Object.fromEntries(Object.entries(workValues).map(([key, value]) => [key, round(value ?? 50)]))
    },
    completedAt: new Date().toISOString()
  };
}
